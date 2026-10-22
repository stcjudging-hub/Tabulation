import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useConnectivity } from './useConnectivity';
import { useJudgePersistence } from './useJudgePersistence';
import { useConfigChange } from '../context/ConfigChangeContext';
import { getHydra_and_Calcu, sanitizeAiHtml } from './getHydration_and_Calculation';
import { buildStaticJudgeTable as buildRichStaticTable } from '../utils/judgeTable';
import { getSchoolId, getJudgeToken } from '../utils/judge';
import { rankValues, formatRank } from '../utils/ranks';
import { refreshAccessToken, clearJudgeSession, redirectToLogin } from '../services/session';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/* ── Client-side config cache helpers ────────────────────────────── */
// DISABLED FOR TESTING — always treat as different, no localStorage
function configsMatch() {
  return false;
}

function saveConfigToLocalStorage() {
  // no-op
}

function loadConfigFromLocalStorage() {
  return null;
}

// How long a stale "admin is regenerating" flag is honored after it was
// written. A normal save + AI generation finishes in ~10-45s; if the admin tab
// dies mid-save the flag would otherwise (a) never be cleared and (b) leave the
// judge on a permanent loading screen. The staleness window is the safety net:
// after it expires the judge treats the flag as gone and falls back to the last
// good table / standard table, then normal slow polling continues and still
// picks the design up the moment one lands.
const UI_GENERATION_STALE_MS = 90000;

// True while the admin's Save/generation is in progress. The admin context
// writes `ui_generating_<school_id>` on save-start and removes it on completion
// (success, failure, or abort). While it is set the judge MUST keep the loading
// state and refuse to apply ui_cache rows (they may still be the previous
// design until the wipe + regeneration happen).
function uiGenerationActive(schoolId) {
  try {
    const raw = localStorage.getItem(`ui_generating_${schoolId}`);
    if (!raw) return false;
    const t = Number(raw);
    if (!t || Number.isNaN(t)) return false;
    return Date.now() - t < UI_GENERATION_STALE_MS;
  } catch {
    return false;
  }
}

// Only the fields below drive the judge's rendered table. Ignoring the rest
// (e.g. is_judge_locked toggles) prevents a pointless overlay flash while a
// polled config update is still applied.
function renderRelevantChanged(a, b) {
  const sig = (c) =>
    JSON.stringify({
      contestants: c.contestants || [],
      criteria:    c.criteria    || [],
      settings: {
        ai_prompt:   c.settings?.ai_prompt   || '',
        ai_provider: c.settings?.ai_provider || 'groq',
        ai_model:    c.settings?.ai_model    || 'openai/gpt-oss-120b',
        ui_mode:     c.settings?.ui_mode     || 'ai',
      },
    });
  return sig(a) !== sig(b);
}

/* ── Plain fetch helpers with the judge JWT ─────────────────────── */
function judgeAuthHeader() {
  const token = getJudgeToken(getSchoolId()) || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function judgePost(path, body, timeoutMs, cancelledRef) {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const onExternalCancel = () => controller.abort();
  if (cancelledRef?.current) {
    onExternalCancel();
  }

  try {
    let res = await fetch(`${API_BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...judgeAuthHeader() },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    if (res.status === 401 && !cancelledRef?.current) {
      let refreshed = true;
      try {
        await refreshAccessToken('judge');
      } catch {
        refreshed = false;
        clearJudgeSession();
        redirectToLogin('judge');
      }
      if (refreshed) {
        res = await fetch(`${API_BASE}${path}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...judgeAuthHeader() },
          body:    JSON.stringify(body),
          signal:  controller.signal,
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Request timed out — showing the standard table.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function judgeGet(path, timeoutMs) {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    let res = await fetch(`${API_BASE}${path}`, {
      headers: judgeAuthHeader(),
      signal:  controller.signal,
    });

    if (res.status === 401) {
      let refreshed = true;
      try {
        await refreshAccessToken('judge');
      } catch {
        refreshed = false;
        clearJudgeSession();
        redirectToLogin('judge');
      }
      if (refreshed) {
        res = await fetch(`${API_BASE}${path}`, {
          headers: judgeAuthHeader(),
          signal:  controller.signal,
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Request timed out — showing the standard table.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ── Small timeout wrapper ──────────────────────────────────────── */
const withTimeout = (promise, ms = 12000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out — showing the standard table.')), ms)
    ),
  ]);

/* ── Hook ────────────────────────────────────────────────────────── */
export const useJudgeSystem = () => {
  const schoolId = getSchoolId();

  const [selectedJudge, setSelectedJudge] = useState(localStorage.getItem(`judge_id_${schoolId}`) || '');
  const [dynamicUI,     setDynamicUI]     = useState('');
  const [config,        setConfig]        = useState({ contestants: [], criteria: [], settings: {} });
  const [loading,       setLoading]       = useState(false);
  const [uiRefreshing,  setUiRefreshing]  = useState(false);
  const [waitSeconds,   setWaitSeconds]   = useState(0);
  const [isComplete,    setIsComplete]    = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState({ show: false });
  const [modal,         setModal]         = useState({ show: false, title: '', message: '', type: 'success' });
// Kept only as a momentary gate before STEP 2 renders the built-in scoring
  // table. The judge is never left on an endless "being generated" screen —
  // if the admin's design isn't cached yet, the standard table shows and swaps
  // in automatically when the design is ready.
  const [uiPending, setUiPending] = useState(false);

  const isOnline = useConnectivity();
  const { saveToCache, loadCache } = useJudgePersistence(selectedJudge, config.contestants, schoolId);

  const { changeCount: configChangeCount, notifyConfigChanged } = useConfigChange();

  // ── Refs that must exist before any effect / callback closes over them ──
  const selectedJudgeRef = useRef(selectedJudge);
  const configRef        = useRef(config);
  const dynamicUIRef     = useRef('');
  // Tracks the previous completion state so the auto-confirm only appears when
  // the judge transitions from an incomplete sheet to a complete one — not on
  // every single edit made after the sheet is already full.
  const completeRef      = useRef(false);

  configRef.current = config;

  useEffect(() => {
    selectedJudgeRef.current = selectedJudge;
  }, [selectedJudge]);

  useEffect(() => {
    dynamicUIRef.current = typeof dynamicUI === 'string' ? dynamicUI : (dynamicUI?.html || '');
  }, [dynamicUI]);

  const showStatus = (title, message, type = 'success', onConfirm) =>
    setModal(onConfirm ? { show: true, title, message, type, onConfirm } : { show: true, title, message, type });

  const closeModal = () => {
    setModal(prev => ({ ...prev, show: false }));
    setTimeout(restoreScores, 0);
  };

  // ── Wait timer: shows elapsed seconds on the judge spinner ──────
  useEffect(() => {
    if (loading || uiRefreshing) {
      setWaitSeconds(0);
      const id = setInterval(() => setWaitSeconds(s => s + 1), 1000);
      return () => clearInterval(id);
    }
    setWaitSeconds(0);
  }, [loading, uiRefreshing]);

  const allScoresFilled = useCallback(() => {
    const dropdowns = document.querySelectorAll('.score-dropdown');
    return dropdowns.length > 0 &&
      Array.from(dropdowns).every(el => el.value !== '' && el.value !== null);
  }, []);

  const evaluateCompleteness = useCallback(() => {
    const complete = allScoresFilled();
    completeRef.current = complete;
    setIsComplete(complete);
    return complete;
  }, [allScoresFilled]);

  const recalculateRow = (contestantId) => {
    const scores = document.querySelectorAll(`[id^="score-${contestantId}-"]`);
    const sum    = Array.from(scores).reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
    const cell   = document.getElementById(`total-${contestantId}`);
    if (cell) cell.innerText = sum.toFixed(2);
  };

  const updateRankings = () => {
    if (!config.contestants?.length) return;
    const rows = config.contestants
      .map(c => ({
        id:    c.id,
        total: parseFloat(document.getElementById(`total-${c.id}`)?.innerText || 0),
      }))
      .filter(item => item.total > 0)
      .map(item => ({ ...item, value: item.total }));

    rankValues(rows, { method: 'midrank', ascending: false });

    rows.forEach(item => {
      const cell = document.getElementById(`rank-${item.id}`);
      if (cell) cell.innerText = formatRank(item.rank);
    });
  };

  const restoreScores = useCallback(() => {
    if (!dynamicUI || !config.criteria?.length || !selectedJudgeRef.current) {
      return;
    }
    getHydra_and_Calcu(
      dynamicUI,
      config,
      saveToCache,
      recalculateRow,
      updateRankings,
      selectedJudgeRef.current,
      loadCache,
      schoolId
    );
  }, [dynamicUI, config, saveToCache, loadCache, schoolId]);

  // ── STEP 1: Load config — cache first (instant), then background sync ─
  useEffect(() => {
    const school_id = getSchoolId();

    const cached = loadConfigFromLocalStorage(school_id);
    if (cached) {
      setConfig(cached);
      setLoading(false);
    }

    const fetchConfig = async () => {
      if (!cached) setLoading(true);
      try {
        const data = await judgeGet(`/public/get-all-data?school_id=${school_id}`, 12000);

        if (data && !data.error) {
          const contestants = data.contestants || [];
          const criteria    = data.criteria    || [];
          const settings    = data.settings    || {};

          const fresh = { contestants, criteria, settings };
          saveConfigToLocalStorage(school_id, fresh);

          setConfig(prev => {
            if (configsMatch(prev, fresh)) return prev;
            return fresh;
          });

          if (!settings.contest_name && !settings.judge_count) {
            setTimeout(async () => {
              try {
                const d2 = await judgeGet(`/public/get-all-data?school_id=${school_id}`, 12000);
                if (d2 && !d2.error) {
                  const contestants2 = d2.contestants || [];
                  const criteria2    = d2.criteria    || [];
                  const settings2    = d2.settings    || {};
                  const fresh2 = { contestants: contestants2, criteria: criteria2, settings: settings2 };
                  saveConfigToLocalStorage(school_id, fresh2);
                  setConfig(prev => (configsMatch(prev, fresh2) ? prev : fresh2));
                }
              } catch { /* silent */ }
            }, 1200);
          }
        } else {
          if (!cached) throw new Error(data.error || 'Failed to load contest config.');
        }
      } catch (err) {
        if (!cached) showStatus('Error', err.message || 'Failed to load contest config.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // ── STEP 1b: Keep the judge in sync with admin saves ─────────────────────
  const configSyncBusyRef = useRef(false);
  const uiRendered        = useRef('');

  useEffect(() => {
    const syncNow = async () => {
      if (configSyncBusyRef.current) return;
      configSyncBusyRef.current = true;
      try {
        const data = await withTimeout(
          judgeGet(`/public/get-all-data?school_id=${schoolId}`),
          12000
        );
        if (!data || data.error) {
          return;
        }

        const fresh = {
          contestants: data.contestants || [],
          criteria:    data.criteria    || [],
          settings:    data.settings    || {},
        };
        saveConfigToLocalStorage(schoolId, fresh);

        if (configsMatch(configRef.current, fresh)) {
          return;
        }

        if (renderRelevantChanged(configRef.current, fresh)) {
          const hasTable = !!dynamicUIRef.current;
          uiRendered.current = '';
          setLoading(!hasTable);
          setUiRefreshing(hasTable);
        }
        setConfig(fresh);
      } catch (err) {
        console.error(`❌ [syncNow] error school=${schoolId}:`, err.message);
      } finally {
        configSyncBusyRef.current = false;
      }
    };

    if (configChangeCount > 0) {
      syncNow();
    }

    const id = setInterval(syncNow, 5000);
    return () => clearInterval(id);
  }, [configChangeCount, schoolId]);

  // ── STEP 2: Render the judge UI — default mode builds instantly, AI mode
  //            only waits for the design the admin already generated ─────────
  const renderSignature = useMemo(() => {
    const { criteria, settings } = config;
    const criteriaSignature = (criteria || [])
      .map(c => `${c.id}:${c.percentage}`)
      .join(',');
    const aiPrompt   = settings?.ai_prompt   || '';
    const aiProvider = settings?.ai_provider || 'groq';
    const aiModel    = settings?.ai_model    || 'openai/gpt-oss-120b';
    const uiMode     = settings?.ui_mode     || 'ai';
    return `${criteriaSignature}::${aiProvider}::${aiPrompt}::${aiModel}::${uiMode}`;
  }, [config]);

  useEffect(() => {
    const { contestants, criteria, settings } = config;

    if (!contestants?.length || !criteria?.length) {
      // Nothing to render → never leave STEP 1b's loader/overlay hanging.
      setLoading(false);
      setUiRefreshing(false);
      setUiPending(false);
      return;
    }

    if (uiRendered.current === renderSignature) {
      setUiRefreshing(false);
      return;
    }
    uiRendered.current = renderSignature;

    const uiMode = settings?.ui_mode || 'ai';

    // Default mode: the built-in table IS the design. Rendered instantly on
    // the client (same rich builder the admin previews), never waits for the
    // AI pipeline, never shows a placeholder.
    if (uiMode === 'default') {
      const staticTable = buildRichStaticTable(
        contestants,
        criteria,
        selectedJudgeRef.current ? `Judge ${selectedJudgeRef.current}` : undefined
      );
      if (staticTable) {
        setDynamicUI(prev => (prev?.html === staticTable ? prev : { html: staticTable }));
      }
      setLoading(false);
      setUiRefreshing(false);
      setUiPending(false);
      return;
    }

    // AI mode: the design lives in ui_cache on the server (the admin generates
    // it from the dashboard's Save button). The judge NEVER calls the AI — it
    // only polls until the cache is ready. Reaching this branch means nothing
    // is on screen yet OR the on-screen table belongs to a different (stale)
    // signature. The system spinner shows while the latest design is pulled from
    // ui_cache — the poll below substitutes the built-in default table ONLY if
    // the cache never lands (offline / failed generation), then auto-swaps in
    // the admin's AI design the moment it exists.
    const hasPrevious = !!dynamicUIRef.current;
    setLoading(false);
    setUiRefreshing(hasPrevious);
    setUiPending(!hasPrevious);
  }, [config, renderSignature, configChangeCount]);

  // Poll the admin-generated ui_cache until a design matching our
  // provider/prompt/model/criteria signature is available. Pure consumer — the
  // admin writes BOTH AI designs and the static Default UI into ui_cache on
  // save, so this polls for both modes. Until the design lands, the built-in
  // scoring table stays on screen (built in STEP 2 / this poll) and is
  // auto-replaced the moment the admin's design is cached. Every config-change
  // notification (configChangeCount) re-kicks the poll so the judge re-fetches
  // the LATEST ui_cache row even when the signature is unchanged (re-save of
  // the same prompt regenerates and overwrites the same hash row).
  useEffect(() => {
    const { contestants, criteria, settings } = configRef.current;
    if (!contestants?.length || !criteria?.length) return;
    const uiMode = settings?.ui_mode || 'ai';
    if (uiMode !== 'ai' && uiMode !== 'default') return;

    const school_id = getSchoolId();
    const criteriaSignature = criteria
      .map(c => `${c.id}:${c.percentage}`)
      .join(',');
    const aiPrompt   = settings?.ai_prompt   || '';
    const aiProvider = settings?.ai_provider || 'groq';
    const aiModel    = settings?.ai_model    || 'openai/gpt-oss-120b';
    const cachedUrl =
      `/judge/render-ui-cached?school_id=${school_id}` +
      `&criteria_signature=${encodeURIComponent(criteriaSignature)}` +
      `&prompt=${encodeURIComponent(aiPrompt)}` +
      `&provider=${encodeURIComponent(aiProvider)}` +
      `&model=${encodeURIComponent(aiModel)}` +
      `&ui_mode=${encodeURIComponent(uiMode)}`;

    let cancelled = false;
    let timer = null;
    let attempts = 0;

    const applyDesign = (html, fromPoll = true) => {
      setDynamicUI(prev => (prev?.html === html ? prev : { html }));
      if (fromPoll) {
        setUiPending(false);
        setUiRefreshing(false);
      }
    };

    const poll = async () => {
      if (cancelled) return;

      // ── Admin regeneration in progress ────────────────────────────────────
      // The moment the admin clicks Save Config (notifySaveStarted) the flag is
      // set. Until it clears we show the loading state on the judge CARD and we
      // NEVER apply a ui_cache row — it may still hold the previous design (the
      // wipe happens inside save-config, slightly after the flag is written).
      // Attempts are reset so nothing "falls back" mid-save; the fast retry
      // stops as soon as the design lands (flag cleared by generate-end).
      if (uiGenerationActive(school_id)) {
        const hasTable = !!dynamicUIRef.current;
        setLoading(false);
        setUiRefreshing(hasTable);
        setUiPending(!hasTable);
        attempts = 0;
        timer = setTimeout(poll, 3000);
        return;
      }

      try {
        const cached = await withTimeout(judgeGet(cachedUrl, 12000), 12000);
        if (cancelled) return;
        if (cached.fromCache === true && cached.html) {
          let html = sanitizeAiHtml(cached.html, criteria);
          // The AI sometimes returns a decorative "GUI" with no scoring inputs
          // at all. Never let the judge end up dropdown-less — fall back to the
          // exact same built-in table used by Default mode so AI designs always
          // render the standard scoring layout (dropdowns per criterion).
          if (!html.includes('score-dropdown')) {
            html = buildRichStaticTable(
              contestants,
              criteria,
              selectedJudgeRef.current ? `Judge ${selectedJudgeRef.current}` : undefined
            );
          }
          applyDesign(html);
          if (cancelled) return;
          // A design is on screen. Keep a light background poll so a re-save of
          // the SAME signature (which overwrites the same hash row) is picked
          // up even without an admin-side "change" signal.
          timer = setTimeout(poll, 15000);
          return;
        }
        // Not cached yet (admin is regenerating). While nothing is on screen
        // keep the system spinner up; AFTER a few fast retries the built-in
        // scoring table substitutes so the page is never a blank placeholder —
        // it then auto-swaps in once the admin's generation lands in ui_cache.
        if (uiMode === 'ai' && attempts >= 3 && !dynamicUIRef.current) {
          const fallback = buildRichStaticTable(
            contestants,
            criteria,
            selectedJudgeRef.current ? `Judge ${selectedJudgeRef.current}` : undefined
          );
          if (fallback) {
            applyDesign(fallback, false);
          }
        }
        if (!dynamicUIRef.current) setUiPending(true);
        else setUiPending(false);
        attempts += 1;
        timer = setTimeout(poll, attempts < 3 ? 4000 : 6000);
      } catch (err) {
        if (cancelled) return;
        console.warn(`⏳ [judge-poll] fetch error (${err.message}) — retrying school=${school_id}`);
        if (!dynamicUIRef.current) setUiPending(true);
        else setUiPending(false);
        attempts += 1;
        timer = setTimeout(poll, attempts < 3 ? 4000 : 6000);
      }
    };

    timer = setTimeout(poll, 0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [renderSignature, configChangeCount]);

  // ── STEP 3: Hydrate UI whenever dynamicUI or selectedJudge changes ─────
  useEffect(() => {
    if (dynamicUI && config.criteria?.length > 0) {
      getHydra_and_Calcu(
        dynamicUI,
        config,
        saveToCache,
        recalculateRow,
        updateRankings,
        selectedJudgeRef.current,
        loadCache,
        schoolId
      );
    }
  }, [dynamicUI, config]);

  // ── Submit scores ────────────────────────────────────────────────
  const submittingRef = useRef(false);
  const submitToDBRef = useRef(null);

  const performSubmit = async () => {
    if (submittingRef.current) return;
    if (!selectedJudge) return showStatus('Error', 'Please select a judge.', 'error');

    if (!allScoresFilled()) {
      return showStatus('Incomplete Scores', 'Please fill in a score for every contestant before submitting.', 'warning');
    }

    const school_id     = getSchoolId();
    const scoreElements = document.querySelectorAll('.score-dropdown');

    if (!scoreElements.length) {
      return showStatus('Error', 'No scores found to submit.', 'error');
    }

    submittingRef.current = true;
    setLoading(true);

    const scores = Array.from(scoreElements).map(el => {
      const [, contestantId, criterionId] = el.id.split('-');
      return {
        contestantId: parseInt(contestantId),
        criterionId:  parseInt(criterionId),
        value:        parseFloat(el.value) || 0,
      };
    });

    try {
      const data = await judgePost('/judge/submit', {
        judgeId: selectedJudge,
        scores,
        school_id,
      }, 15000);

      if (data.success) {
        getHydra_and_Calcu(
          dynamicUI,
          config,
          saveToCache,
          recalculateRow,
          updateRankings,
          selectedJudge,
          loadCache,
          school_id
        );
        // Tell the admin leaderboard (and any other open tabs) that scores
        // just landed, so the rankings refresh instead of showing stale data
        // until someone clicks the manual Refresh button.
        try { notifyConfigChanged(); } catch { /* ignore */ }
        showStatus('Success', 'Scores submitted successfully!', 'success');
      }
    } catch (err) {
      showStatus('Error', err.message || 'Failed to connect to server.', 'error');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const cancelSubmit = useCallback(() => {
    setSubmitConfirm({ show: false });
    // Re-hydrate from the local cache so a cancelled review leaves the sheet
    // exactly as the judge left it.
    window.setTimeout(restoreScores, 0);
  }, [restoreScores]);

  const confirmSubmit = () => {
    if (!submitConfirm.show) return;
    setSubmitConfirm({ show: false });
    performSubmit();
  };

  const submitToDB = () => {
    if (submittingRef.current) return;
    if (!selectedJudge) return showStatus('Error', 'Please select a judge.', 'error');
    if (!allScoresFilled()) {
      return showStatus('Incomplete Scores', 'Please complete the scoring before submitting.', 'warning');
    }
    setSubmitConfirm({ show: true });
  };

  submitToDBRef.current = submitToDB;

  useEffect(() => {
    const handleChange = (e) => {
      if (!e.target?.classList?.contains('score-dropdown')) return;

      const wasComplete = completeRef.current;
      const nowComplete = evaluateCompleteness();

      if (e.target.value === '' || e.target.value === null) return;

      // The final score was just filled in → open the confirmation step instead
      // of silently submitting. Later edits on an already-complete sheet do
      // not re-open it; the judge can still use the main Submit Scores button.
      if (nowComplete && !wasComplete) {
        submitToDBRef.current?.();
      }
    };
    document.addEventListener('change', handleChange);
    return () => document.removeEventListener('change', handleChange);
  }, [evaluateCompleteness]);

  useEffect(() => {
    if (!dynamicUI) return;
    // Capture the restored sheet's completion state immediately and once more
    // after hydration settles, so changing a score on an already-complete sheet
    // doesn't look like a fresh completion.
    evaluateCompleteness();
    const t = setTimeout(() => evaluateCompleteness(), 500);
    return () => clearTimeout(t);
  }, [dynamicUI, selectedJudge, evaluateCompleteness]);

  const updateJudge = useCallback((val) => {
    if (!val) return;

    setSelectedJudge(val);
    localStorage.setItem(`judge_id_${schoolId}`, val);
    selectedJudgeRef.current = val;

    if (dynamicUI && config.criteria?.length > 0) {
      getHydra_and_Calcu(
        dynamicUI,
        config,
        saveToCache,
        recalculateRow,
        updateRankings,
        val,
        [],
        schoolId
      );
    }
  }, [dynamicUI, config, saveToCache, schoolId]);

  return {
    selectedJudge,
    dynamicUI,
    config,
    loading,
    uiRefreshing,
    uiPending,
    waitSeconds,
    isComplete,
    modal,
    submitConfirm,
    isOnline,
    closeModal,
    submitToDB,
    confirmSubmit,
    cancelSubmit,
    updateJudge,
  };
};