import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../layouts/AdminLayout";
import Button from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui";
import SectionRender from "./sections/sectionRender"
import GenerationProgress from "./components/GenerationProgress";
import { streamUiUi } from "../../utils/streamUi";
import apiClient from "../../services/api";
import { useConfigChange } from '../../context/ConfigChangeContext';


function Dashboard() {
  const { notifySaveStarted, notifySaveFinished } = useConfigChange();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // ── Contest settings ────────────────────────────────────────────────────
  const [contestName,     setContestName]     = useState("");
  const [contestType,     setContestType]     = useState("pageant");
  const [aiPrompt,        setAiPrompt]        = useState("");
  const [aiProvider,      setAiProvider]      = useState("groq");
  const [aiModel,         setAiModel]         = useState("openai/gpt-oss-120b");
  const [uiMode,          setUiMode]          = useState("ai");
  const [judgeCount,      setJudgeCount]      = useState(3);
  const [calculationType, setCalculationType] = useState("average");
  const [customBase,      setCustomBase]      = useState("average");
  const [tieBreakMethod,  setTieBreakMethod]  = useState("midrank");

  // ── Criteria & Contestants ────────────────────────────────────────────────
  const [criteria,    setCriteria]    = useState([]);
  const [contestants, setContestants] = useState([]);

  // ── Add-form helpers ──────────────────────────────────────────────────────
  const [newCrit,   setNewCrit]   = useState("");
  const [newWeight, setNewWeight] = useState(10);
  const [newName,   setNewName]   = useState("");

  // ── System config ─────────────────────────────────────────────────────────
  const [schoolName,     setSchoolName]     = useState("");
  const [portalName,     setPortalName]     = useState("");
  const [schoolLogo,     setSchoolLogo]     = useState("");
  const [backgroundLogo, setBackgroundLogo] = useState("");
  const [primaryColor,   setPrimaryColor]   = useState("#40916C");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [footerText,     setFooterText]     = useState("");
  const [logoRadius,     setLogoRadius]     = useState(12);
  const [headerTemplate, setHeaderTemplate] = useState("structured");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeNav,       setActiveNav]       = useState("overview");
  const [toast,           setToast]           = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving,          setSaving]          = useState(false);

  // ── AI generation terminal state ───────────────────────────────────────────
  const [aiGen, setAiGen] = useState({
    active: false, status: 'idle', text: '', error: '',
    model: '', startedAt: null, cached: false, generationId: null,
  });
  const genTextRef      = useRef('');
  const genFlushTimer   = useRef(null);
  const genAbortRef     = useRef(null);

  const flushGenText = () => {
    genFlushTimer.current = null;
    setAiGen(prev => ({ ...prev, text: genTextRef.current }));
  };
  const appendGenText = (delta) => {
    genTextRef.current += delta;
    if (!genFlushTimer.current) genFlushTimer.current = setTimeout(flushGenText, 80);
  };
  const closeAiGen = () => {
    if (genAbortRef.current) genAbortRef.current.abort();
    if (genFlushTimer.current) { clearTimeout(genFlushTimer.current); genFlushTimer.current = null; }
    setAiGen(prev => ({ ...prev, active: false }));
  };

  // Keep activeNav in sync with the ?tab= query param (set by the sidebar)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveNav(tab);
  }, [searchParams]);

  const setActiveNavFromTab = (tab) => {
    setActiveNav(tab);
    // Preserve existing query params (e.g. ?school_id=…) so the URL keeps
    // identifying the school this dashboard belongs to.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  // ── Track window width for responsive layout ──────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadAllData = async () => {
    try {
      const { settings, contestants: rawC, criteria: rawCr } =
        await apiClient.get("/get-all-data");
      setContestName(settings.contest_name ?? "");
      setContestType(settings.contest_type ?? "pageant");
      setAiPrompt(settings.ai_prompt ?? "");
      setAiProvider(settings.ai_provider ?? "groq");
      setAiModel(settings.ai_model ?? "openai/gpt-oss-120b");
      setUiMode(settings.ui_mode ?? "ai");
      setJudgeCount(Number(settings.judge_count ?? 3));
      setCalculationType(settings.computation_type ?? "average");
      setCustomBase(settings.custom_base ?? "average");
      // 'shared' was removed from the UI; fall back to the default so the
      // Tie-Break Method always shows a selectable option.
      setTieBreakMethod(settings.tie_break_method === 'shared' ? 'midrank' : settings.tie_break_method ?? 'midrank');
      setContestants(
        (rawC || []).map((c) => ({ id: String(c.id), name: c.name, number: c.entry_number }))
      );
      setCriteria(
        (rawCr || []).map((cr) => ({ id: String(cr.id), name: cr.name, weight: Number(cr.percentage) }))
      );
    } catch (err) {
      showToast("error", "Failed to load data: " + err.message);
    }

    try {
      const data = await apiClient.get("/system-config");
      if (data.school_name     !== undefined) setSchoolName(data.school_name ?? "");
      if (data.portal_name     !== undefined) setPortalName(data.portal_name ?? "");
      if (data.school_logo     !== undefined) setSchoolLogo(data.school_logo ?? "");
      if (data.background_logo !== undefined) setBackgroundLogo(data.background_logo ?? "");
      if (data.primary_color   !== undefined) setPrimaryColor(data.primary_color ?? "#40916C");
      if (data.secondary_color !== undefined) setSecondaryColor(data.secondary_color ?? "#0f172a");
      if (data.footer_text     !== undefined) setFooterText(data.footer_text ?? "");
      if (data.logo_radius     !== undefined) setLogoRadius(Number(data.logo_radius ?? 12));
      if (data.header_template !== undefined) setHeaderTemplate(data.header_template ?? "structured");
    } catch (err) {
      console.error("system-config load error:", err);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  // Flow (AI mode): save settings first → open the streaming terminal → the
  // backend streams the LLM code into ui_cache in real time. The Save button
  // stays locked ("Generating UI…") until the AI finishes, so the admin always
  // knows the design is fully saved before the judges can grab it.
  const onSave = async () => {
    setSaving(true);
    // Open the terminal immediately with the loading spinner for BOTH modes —
    // it stays streaming/spinner until the design (AI-generated or the static
    // Default table) is written into ui_cache, then flips to done.
    genTextRef.current = '';
    setAiGen({ active: true, status: 'streaming', text: '', error: '', model: aiModel, startedAt: Date.now(), cached: false, generationId: null });
    // Tell every open judge terminal to reload RIGHT NOW (before the config is
    // even saved). The judge card shows its loading spinner and waits for the
    // regenerated UI; it ignores the old ui_cache row while the flag is set.
    notifySaveStarted();
    try {
      const payload = {
        contest_name:     contestName,
        contest_type:     contestType,
        ai_prompt:        aiPrompt,
        ai_model:         aiModel,
        ai_provider:      aiProvider,
        ui_mode:          uiMode,
        judge_count:      judgeCount,
        computation_type: calculationType,
        custom_base:      customBase,
        tie_break_method: tieBreakMethod,
        contestants: contestants.map((c)  => ({ name: c.name, entry_number: c.number })),
        criteria:    criteria.map((cr)    => ({ name: cr.name, percentage: cr.weight })),
      };
      await apiClient.post("/save-config", payload);
      await apiClient.post("/save-system-config", {
        school_name:     schoolName,    portal_name:     portalName,
        school_logo:     schoolLogo,    background_logo: backgroundLogo,
        primary_color:   primaryColor,  secondary_color: secondaryColor,
        footer_text:     footerText,    logo_radius:     logoRadius,
        header_template: headerTemplate,
      });

      if (uiMode === "ai") {
        if (genFlushTimer.current) { clearTimeout(genFlushTimer.current); genFlushTimer.current = null; }
        genAbortRef.current = new AbortController();

        try {
          const result = await streamUiUi({
            aiPrompt: aiPrompt || 'Modern and Professional',
            aiModel,
            uiMode,
            contestants,
            criteria,
            signal: genAbortRef.current.signal,
            onDelta: appendGenText,
          });
          if (genFlushTimer.current) { clearTimeout(genFlushTimer.current); genFlushTimer.current = null; }
          setAiGen(prev => ({
            ...prev,
            // Use the backend's final (sanitized + repaired) HTML so the
            // preview and "Copy HTML" always show the aligned scoring layout,
            // never a broken AI shell that streamed into the terminal live.
            text: result.html || genTextRef.current,
            status: 'done',
            cached: !!result.fromCache,
            generationId: result.generationId || null,
          }));
          showToast("success", "Configuration saved! AI Judge UI generated.");
        } catch (genErr) {
          if (genFlushTimer.current) { clearTimeout(genFlushTimer.current); genFlushTimer.current = null; }
          if (genErr && genErr.name === 'AbortError') {
            setAiGen(prev => ({ ...prev, status: 'error', error: 'Generation stopped by you. The saved design will not appear until it finishes.' }));
          } else {
            setAiGen(prev => ({ ...prev, status: 'error', error: genErr.message }));
            showToast("error", "Config saved, but AI UI failed: " + genErr.message);
          }
        } finally {
          genAbortRef.current = null;
        }
      } else {
        // Default mode: STILL persist the design into ui_cache so the judge
        // fetches the exact same table (no LLM call — the backend builds and
        // stores it instantly). The terminal opened above shows the loading
        // spinner while the cache write runs, then flips to done.
        let cacheOk = true;
        let result = { fromCache: false, generationId: null };
        if (contestants.length && criteria.length) {
          try {
            result = (await streamUiUi({
              aiPrompt: aiPrompt || 'Modern and Professional',
              aiModel,
              uiMode,
              contestants,
              criteria,
            })) || { fromCache: false, generationId: null };
          } catch (cacheErr) {
            cacheOk = false;
            setAiGen(prev => ({ ...prev, status: 'error', error: cacheErr.message }));
            showToast("error", "Config saved, but the Default UI cache write failed: " + cacheErr.message);
          }
        }
        if (cacheOk) {
          setAiGen(prev => ({
            ...prev,
            status: 'done',
            cached: !!result.fromCache,
            generationId: result.generationId || null,
          }));
          showToast("success", "Configuration saved! Default Judge UI ready.");
        }
      }

      await loadAllData();
    } catch (err) {
      setAiGen(prev => ({ ...prev, active: false }));
      showToast("error", "Save failed: " + err.message);
    } finally {
      // Always release the judge terminals here — success, AI generation
      // failure, OR a hard save-config error. The flag being stuck would leave
      // judges loading forever (the exact infinite loop we must avoid). After
      // this, judges grab whatever ui_cache holds (new design on success, the
      // previous row on rollback/failure) and normal background polling resumes.
      notifySaveFinished();
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const onDelete = async () => {
    setShowDeleteModal(false);
    try {
      await apiClient.delete("/reset-data");
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ui_html_cache_"))
        .forEach((k) => localStorage.removeItem(k));
      showToast("success", "All data cleared.");
      await loadAllData();
    } catch (err) {
      showToast("error", "Reset failed: " + err.message);
    }
  };

  const totalWeight = criteria.reduce((s, c) => s + Number(c.weight || 0), 0);

  const SaveButton = ({ full }) => (
    <Button
      variant="primary"
      full={full}
      loading={saving}
      loadingText={uiMode === "ai" ? "Generating UI…" : "Saving…"}
      onClick={onSave}
      disabled={saving}
    >
      <span>✓</span> Save Config
    </Button>
  );

  return (
    <>
      <AdminLayout activeNav={activeNav} setActiveNav={setActiveNavFromTab} wide>
        {/* Header row */}
        <div
          className={`flex justify-between gap-3 sm:gap-4 mb-5 lg:mb-8 ${
                isMobile ? "flex-col items-stretch" : "flex-row items-start"
              }`}
            >
              <div className="min-w-0">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest mb-2 bg-[var(--gold-lt)] text-[var(--gold)] border border-[var(--gold-bd)]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                  Admin Dashboard
                </div>
                <h1
                  className={`heading-serif mt-3 lg:mt-0 font-bold tracking-tight text-[var(--text1)] max-w-full ${
                    isMobile
                      ? "text-xl leading-tight line-clamp-2 whitespace-normal"
                      : "text-2xl leading-tight overflow-hidden text-ellipsis whitespace-nowrap"
                  }`}
                >
                  {contestName || "Competition Setup"}
                </h1>
                <div className="gold-rule mt-2.5" />
              </div>

              {/* Save button lives inline on desktop; on mobile it's a sticky bottom bar instead */}
              {!isMobile && <SaveButton />}
            </div>

            <div className="h-px mb-8 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />

            <SectionRender
              activeNav={activeNav}
              contestName={contestName}         setContestName={setContestName}
              contestType={contestType}         setContestType={setContestType}
              aiPrompt={aiPrompt}               setAiPrompt={setAiPrompt}
              aiProvider={aiProvider}           setAiProvider={setAiProvider}
              aiModel={aiModel}                  setAiModel={setAiModel}
              uiMode={uiMode}                    setUiMode={setUiMode}
              judgeCount={judgeCount}           setJudgeCount={setJudgeCount}
              calculationType={calculationType} setCalculationType={setCalculationType}
              customBase={customBase}           setCustomBase={setCustomBase}
              tieBreakMethod={tieBreakMethod}   setTieBreakMethod={setTieBreakMethod}
              criteria={criteria}               setCriteria={setCriteria}
              contestants={contestants}         setContestants={setContestants}
              newCrit={newCrit}                 setNewCrit={setNewCrit}
              newWeight={newWeight}             setNewWeight={setNewWeight}
              newName={newName}                 setNewName={setNewName}
              totalWeight={totalWeight}
              setShowDeleteModal={setShowDeleteModal}
              schoolName={schoolName}           setSchoolName={setSchoolName}
              portalName={portalName}           setPortalName={setPortalName}
              schoolLogo={schoolLogo}           setSchoolLogo={setSchoolLogo}
              backgroundLogo={backgroundLogo}   setBackgroundLogo={setBackgroundLogo}
              primaryColor={primaryColor}       setPrimaryColor={setPrimaryColor}
              secondaryColor={secondaryColor}   setSecondaryColor={setSecondaryColor}
              footerText={footerText}           setFooterText={setFooterText}
              logoRadius={logoRadius}           setLogoRadius={setLogoRadius}
              headerTemplate={headerTemplate}   setHeaderTemplate={setHeaderTemplate}
              aiGen={aiGen}
            />
          </AdminLayout>

      {/* Sticky mobile save bar — always reachable, never overlapped */}
      {isMobile && (
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-[var(--bg)] border-t border-[var(--border)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <SaveButton full />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`save-toast ${toast.type === "error" ? "bg-[#be123c]" : ""}`}
        >
          <span>{toast.type === "error" ? "✗" : "✓"}</span> {toast.msg}
        </div>
      )}

      <GenerationProgress
        variant="modal"
        open={aiGen.active}
        status={aiGen.status}
        text={aiGen.text}
        error={aiGen.error}
        model={aiGen.model}
        startedAt={aiGen.startedAt}
        cached={aiGen.cached}
        generationId={aiGen.generationId}
        onClose={closeAiGen}
      />

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Reset System Data?"
        message="DANGER: This will permanently delete all contestants, criteria, and scores. This action cannot be undone."
        confirmLabel="Confirm Reset"
        onConfirm={onDelete}
        onCancel={() => setShowDeleteModal(false)}
        danger
      />
    </>
  );
}

export default Dashboard;