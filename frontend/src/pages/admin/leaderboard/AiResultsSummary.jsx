import { useState } from 'react';
import apiClient from '../../../services/api';

const SparkIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
);

const Chip = ({ tone = 'default', children }) => {
  const tones = {
    default: 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border)]',
    good:    'bg-[var(--accent-lt)] text-[var(--accent)] border-[var(--accent-bd)]',
    warn:    'bg-[#fff7ed] text-[#b45309] border-[#fed7aa]',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

// ── AI results summary ───────────────────────────────────────────────────────
// Generates a plain-language report from the computed standings on demand.
// The backend computes all facts (winners, margin, ties, inconsistent judges)
// and only asks the LLM to narrate them, so nothing here is fabricated.
export default function AiResultsSummary() {
  const [loading, setLoading] = useState(false);
  const [report, setReport]   = useState(null);
  const [error, setError]     = useState('');
  const [at, setAt]           = useState(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/results-summary', {});
      if (!res?.summary) throw new Error('The AI returned an empty summary.');
      setReport(res);
      setAt(new Date());
    } catch (err) {
      setError(err.message || 'Could not generate the summary.');
    } finally {
      setLoading(false);
    }
  };

  const facts = report?.facts || {};
  const hasIssues = (facts.inconsistent?.judgeOutliers?.length || 0) > 0
    || (facts.inconsistent?.judgeBias?.length || 0) > 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-sm overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-mid)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/10 rounded-sm flex items-center justify-center shrink-0">
            <SparkIcon size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm">AI Results Summary</div>
            <div className="text-white/50 text-[10px] hidden sm:block">Plain-language report of the computed results</div>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            loading ? 'bg-white/20 text-white/70 cursor-wait' : 'bg-white text-[var(--accent)] hover:opacity-90'
          }`}
        >
          {loading ? 'Writing…' : report ? 'Regenerate' : 'Generate summary'}
        </button>
      </div>

      {error && (
        <div className="px-4 sm:px-6 py-3 text-xs font-semibold text-[#b91c1c] bg-[#fee2e2] border-t border-[#fca5a5]">
          {error}
        </div>
      )}

      {!report && !error && !loading && (
        <div className="px-4 sm:px-6 py-5 text-xs text-[var(--text3)]">
          Generate a short report describing the winners, how close the scores were, any ties, and scores flagged as inconsistent.
        </div>
      )}

      {loading && !report && (
        <div className="px-4 sm:px-6 py-5 text-xs text-[var(--text3)]">Analyzing the standings…</div>
      )}

      {report && (
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--text1)] whitespace-pre-wrap">{report.summary}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {(facts.winners || []).map((w) => (
              <Chip key={`w-${w.name}`} tone="good">Winner: {w.name}</Chip>
            ))}
            {facts.margin != null && (
              <Chip tone="default">Top margin: {facts.margin}</Chip>
            )}
            {(facts.ties || []).map((t, i) => (
              <Chip key={`t-${i}`} tone="default">Tie @ {t.rank}: {t.names.join(', ')}</Chip>
            ))}
            {!hasIssues && <Chip tone="good">No inconsistent scoring detected</Chip>}
            {(facts.inconsistent?.judgeBias || []).map((b, i) => (
              <Chip key={`jb-${i}`} tone="warn">
                Judge {b.judgeId} averaged {b.average} ({b.direction} vs panel {b.panelAverage})
              </Chip>
            ))}
            {(facts.inconsistent?.judgeOutliers || []).map((o, i) => (
              <Chip key={`jo-${i}`} tone="warn">
                Judge {o.judgeId} on {o.contestant}: {o.score} ({o.direction} than peers ~{o.peerAverage})
              </Chip>
            ))}
          </div>

          {at && (
            <div className="text-[10px] text-[var(--text3)]">
              Generated at {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} — regenerate after new scores arrive.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
