// pages/LeaderBoard.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../services/api';
import { getSchoolId } from '../../utils/getSchoolId';
import { rankValues } from '../../utils/ranks';
import { usePresence } from '../../hooks/usePresence';
import { useConfigChange } from '../../context/ConfigChangeContext';
import {
  getOrdinal, ExportAllPanel,
  ErrorState, FullscreenView, HeroBanner, LoadingState, NavBar, RefreshBar,
  Table1FinalStandings, Table2JudgeSummary, Table3JudgeBreakdowns,
  exportToCSV, exportToXLSX, exportToPNG,
  AiResultsSummary
} from './leaderboard/index';

const DEFAULT_FS_CONFIG = {
  bgColor:      '#1B4332',
  accentColor:  '#1B4332',
  textColor:    '#ffffff',
  titleText:    '',
  subtitleText: '',
};

const LeaderBoard = () => {
  usePresence('admin');
  const { changeCount: configChangeCount } = useConfigChange();
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [data,         setData]         = useState({ contestants: [], criteria: [], settings: {} });
  const [standings,    setStandings]    = useState([]);
  const [judgeScores,  setJudgeScores]  = useState({});
  const [judgeIds,     setJudgeIds]     = useState([]);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsConfig,     setFsConfig]     = useState(DEFAULT_FS_CONFIG);
  const [fsSaving,     setFsSaving]     = useState(false);
  const [fsSaved,      setFsSaved]      = useState(false);

  // ── Load fullscreen config from backend ──────────────────────
  const loadFsConfig = useCallback(async () => {
    const schoolId = getSchoolId();
    if (!schoolId) return;
    try {
      const res = await apiClient.get(`/leaderboard/fullscreen-config?school_id=${schoolId}`);
      if (res && !res.error) {
        setFsConfig({
          bgColor:      res.bg_color      || DEFAULT_FS_CONFIG.bgColor,
          accentColor:  res.accent_color  || DEFAULT_FS_CONFIG.accentColor,
          textColor:    res.text_color    || DEFAULT_FS_CONFIG.textColor,
          titleText:    res.title_text    || DEFAULT_FS_CONFIG.titleText,
          subtitleText: res.subtitle_text || DEFAULT_FS_CONFIG.subtitleText,
        });
      }
    } catch {
      // silent — just use defaults
    }
  }, []);

  // ── Save fullscreen config to backend ────────────────────────
  const saveFsConfig = useCallback(async () => {
    const schoolId = getSchoolId();
    if (!schoolId) return;
    setFsSaving(true);
    try {
      await apiClient.post('/leaderboard/fullscreen-config', {
        school_id:    schoolId,
        bg_color:     fsConfig.bgColor,
        accent_color: fsConfig.accentColor,
        text_color:   fsConfig.textColor,
        title_text:   fsConfig.titleText,
        subtitle_text: fsConfig.subtitleText,
      });
      setFsSaved(true);
      setTimeout(() => setFsSaved(false), 2000);
    } catch (err) {
      console.error('[LeaderBoard] save fsConfig failed:', err.message);
    } finally {
      setFsSaving(false);
    }
  }, [fsConfig]);

  // silent=true skips the full-page <LoadingState> — background refreshes (live
  // config signal, the 15s poll) must swap the numbers in place, never flicker.
  const fetchResults = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const schoolId = getSchoolId();
      if (!schoolId) throw new Error('Could not determine school ID from session. Please log in again.');

      const [configData, lbData, rawJudgeIds] = await Promise.all([
        apiClient.get(`/public/get-all-data?school_id=${schoolId}`),
        apiClient.get(`/public/leaderboard?school_id=${schoolId}`).catch(err => {
          console.warn('[LeaderBoard] leaderboard failed:', err.message);
          return [];
        }),
        apiClient.get(`/public/judge/ids?school_id=${schoolId}`).catch(err => {
          console.warn('[LeaderBoard] judge/ids failed:', err.message);
          return [];
        }),
      ]);

      const safeConfig = configData || { contestants: [], criteria: [], settings: {} };
      setData(safeConfig);

      const judgeCount = Number(safeConfig?.settings?.judge_count) || 0;

      const lbArray = Array.isArray(lbData) ? lbData : Array.isArray(lbData?.data) ? lbData.data : [];
      setStandings(lbArray.map((item, idx) => ({ ...item, rank: item.rank ?? idx + 1 })));

      const idsRaw      = Array.isArray(rawJudgeIds) ? rawJudgeIds : Array.isArray(rawJudgeIds?.data) ? rawJudgeIds.data : [];
      const resolvedIds = idsRaw.length > 0
        ? idsRaw
        : Array.from({ length: judgeCount }, (_, i) => i + 1);
      setJudgeIds(resolvedIds);

      const judgeEntries = await Promise.all(
        resolvedIds.map(async (judgeId) => {
          try {
            const res    = await apiClient.get(`/public/judge/scores?school_id=${schoolId}&judgeId=${judgeId}`);
            const scores = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            return [judgeId, scores];
          } catch (err) {
            console.warn(`[LeaderBoard] judge ${judgeId} scores failed:`, err.message);
            return [judgeId, []];
          }
        })
      );

      setJudgeScores(Object.fromEntries(judgeEntries));
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[LeaderBoard] Fetch error:', err);
      setError(err.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
    loadFsConfig();
  }, [fetchResults, loadFsConfig]);

  // Real-time: judges' submitted scores and admin saves broadcast a config-change
  // signal (ConfigChangeContext). Refetch immediately so the standings reflect
  // new submissions without waiting for the poll or the manual Refresh button.
  const prevConfigChange = useRef(configChangeCount);
  useEffect(() => {
    if (prevConfigChange.current === configChangeCount) return;
    prevConfigChange.current = configChangeCount;
    fetchResults(true);
  }, [configChangeCount, fetchResults]);

  // Light background poll as a cross-device fallback (BroadcastChannel is
  // same-browser only — a judge scoring from another device is still picked up).
  const fullscreenRef = useRef(isFullscreen);
  useEffect(() => { fullscreenRef.current = isFullscreen; }, [isFullscreen]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!fullscreenRef.current) fetchResults(true);
    }, 15000);
    return () => clearInterval(id);
  }, [fetchResults]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Custom mode inherits the base calculation (average or rank) from settings;
  // the tie-break method only affects how equal values are ranked.
  const compType   = data.settings?.computation_type;
  const isRankMode = (compType === 'rank' || (compType === 'custom' && data.settings?.custom_base === 'rank'));
  const judgeCount  = judgeIds.length || Number(data.settings?.judge_count) || 0;
  const contestName = data.settings?.contest_name || 'Competition';

  const getJudgeScore = (name, judgeId) => {
    const found = (judgeScores[judgeId] || []).find(s => s.name === name);
    return found ? parseFloat(found.total) : null;
  };

  const getJudgeRank = (name, judgeId) => {
    const list = judgeScores[judgeId] || [];
    const found = list.find(s => s.name === name);
    if (found && found.rank != null) return found.rank;
    // Fallback: compute midrank client-side if the backend hasn't ranked yet.
    const ranked = rankValues(list.map(s => ({ ...s, value: s.total })));
    const r = ranked.find(s => s.name === name);
    return r ? r.rank : null;
  };

  const rankValueOf = (c) => (isRankMode ? c.total_rank : parseFloat(c.final_score).toFixed(2));

  const exportStandingsCSV = () => {
    const headers = ['Rank', 'Contestant', isRankMode ? 'Rank Sum' : 'Final Average'];
    const rows    = standings.map((c) => [
      c.rank, c.name,
      isRankMode ? c.total_rank : parseFloat(c.final_score).toFixed(2),
    ]);
    exportToCSV(`${contestName}_standings.csv`, headers, rows);
  };

  const exportStandingsXLSX = () => {
    const headers = ['Rank', 'Contestant', isRankMode ? 'Rank Sum' : 'Final Average'];
    const rows    = standings.map((c) => [
      c.rank, c.name,
      isRankMode ? c.total_rank : parseFloat(c.final_score).toFixed(2),
    ]);
    exportToXLSX(`${contestName}_standings.xlsx`, { name: 'Final Standings', headers, rows });
  };

  const exportSummaryCSV = () => {
    const judgeHeaders = judgeIds.flatMap(jId =>
      isRankMode ? [`Judge ${jId} Score`, `Judge ${jId} Rank`] : [`Judge ${jId} Score`]
    );
    const headers = ['Place', 'Contestant', ...judgeHeaders, isRankMode ? 'Rank Sum' : 'Final Avg'];
    const rows    = standings.map((c) => {
      const judgeData = judgeIds.flatMap(jId => {
        const score = getJudgeScore(c.name, jId);
        const rank  = getJudgeRank(c.name, jId);
        return isRankMode
          ? [score !== null ? score.toFixed(2) : '—', getOrdinal(rank)]
          : [score !== null ? score.toFixed(2) : '—'];
      });
      return [c.rank, c.name, ...judgeData, rankValueOf(c)];
    });
    exportToCSV(`${contestName}_judge_summary.csv`, headers, rows);
  };

  const exportSummaryXLSX = () => {
    const judgeHeaders = judgeIds.flatMap(jId =>
      isRankMode ? [`Judge ${jId} Score`, `Judge ${jId} Rank`] : [`Judge ${jId} Score`]
    );
    const headers = ['Place', 'Contestant', ...judgeHeaders, isRankMode ? 'Rank Sum' : 'Final Avg'];
    const rows    = standings.map((c) => {
      const judgeData = judgeIds.flatMap(jId => {
        const score = getJudgeScore(c.name, jId);
        const rank  = getJudgeRank(c.name, jId);
        return isRankMode
          ? [score !== null ? score.toFixed(2) : '—', getOrdinal(rank)]
          : [score !== null ? score.toFixed(2) : '—'];
      });
      return [c.rank, c.name, ...judgeData, rankValueOf(c)];
    });
    exportToXLSX(`${contestName}_judge_summary.xlsx`, { name: 'Judge Summary', headers, rows });
  };

  const exportJudgesCSV = () => {
    const lines = [];
    for (const judgeId of judgeIds) {
      const scores = [...(judgeScores[judgeId] || [])].sort((a, b) => b.total - a.total);
      lines.push(`Judge ${judgeId}`);
      lines.push(['Rank', 'Contestant', 'Total'].join(','));
      scores.forEach((row, rIdx) => lines.push([row.rank ?? rIdx + 1, row.name, parseFloat(row.total).toFixed(2)].join(',')));
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${contestName}_judge_breakdowns.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJudgesXLSX = () => {
    const sheets = judgeIds.map((judgeId) => {
      const scores = [...(judgeScores[judgeId] || [])].sort((a, b) => b.total - a.total);
      return {
        name:   `Judge ${judgeId}`,
        headers: ['Rank', 'Contestant', 'Total'],
        rows: scores.map((row, rIdx) => [
          row.rank ?? rIdx + 1,
          row.name,
          parseFloat(row.total).toFixed(2),
        ]),
      };
    });
    exportToXLSX(`${contestName}_judge_breakdowns.xlsx`, sheets);
  };

  const exportStandingsPNG = () => exportToPNG('table-standings', `${contestName}_standings.png`);
  const exportSummaryPNG   = () => exportToPNG('table-summary',   `${contestName}_judge_summary.png`);
  const exportJudgesPNG    = () => exportToPNG('table-judges',    `${contestName}_judge_breakdowns.png`);

  const handleExportAll = (selected, format) => {
    const batch = [];
    if (selected.standings) {
      batch.push(format === 'csv' ? exportStandingsCSV : format === 'xlsx' ? exportStandingsXLSX : exportStandingsPNG);
    }
    if (selected.summary) {
      batch.push(format === 'csv' ? exportSummaryCSV : format === 'xlsx' ? exportSummaryXLSX : exportSummaryPNG);
    }
    if (selected.judges) {
      batch.push(format === 'csv' ? exportJudgesCSV : format === 'xlsx' ? exportJudgesXLSX : exportJudgesPNG);
    }
    // Spread file downloads out slightly so the browser never feels a bulk save
    batch.forEach((fn, idx) => setTimeout(fn, idx * (format === 'png' ? 600 : 60)));
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={() => fetchResults(false)} />;

  if (isFullscreen) {
    return (
      <FullscreenView
        data={data}
        standings={standings}
        isRankMode={isRankMode}
        onExit={() => setIsFullscreen(false)}
        onExportCSV={exportStandingsCSV}
        fsConfig={fsConfig}
        onFsConfigChange={setFsConfig}
        onSave={saveFsConfig}
        isSaving={fsSaving}
        isSaved={fsSaved}
      />
    );
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen font-['Inter',sans-serif] text-[var(--text1)]">
      <NavBar />
      <HeroBanner contestName={contestName} isRankMode={isRankMode} />

      <div className="max-w-5xl xl:max-w-[1440px] 2xl:max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <ExportAllPanel onExportAll={handleExportAll} />

        <AiResultsSummary />

        <Table1FinalStandings
          standings={standings}
          isRankMode={isRankMode}
          onFullscreen={() => setIsFullscreen(true)}
          onCSV={exportStandingsCSV}
          onPNG={exportStandingsPNG}
          onXLSX={exportStandingsXLSX}
        />

        <Table2JudgeSummary
          standings={standings}
          judgeIds={judgeIds}
          isRankMode={isRankMode}
          judgeCount={judgeCount}
          getJudgeScore={getJudgeScore}
          getJudgeRank={getJudgeRank}
          onCSV={exportSummaryCSV}
          onPNG={exportSummaryPNG}
          onXLSX={exportSummaryXLSX}
        />

        <Table3JudgeBreakdowns
          judgeIds={judgeIds}
          judgeScores={judgeScores}
          onCSV={exportJudgesCSV}
          onPNG={exportJudgesPNG}
          onXLSX={exportJudgesXLSX}
        />

        <RefreshBar onRefresh={() => fetchResults(false)} lastRefresh={lastRefresh} />
      </div>
    </div>
  );
};

export default LeaderBoard;