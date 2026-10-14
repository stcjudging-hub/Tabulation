import React, { useState } from 'react';
import { Sparkles, WandSparkles, Check, X } from 'lucide-react';
import apiClient from '../../../services/api';

// AI prompt → suggested criteria. Read-only proposal; "Use and edit" copies the
// rows into the editable criteria list below.
const DEFAULT_DESCRIPTION =
  'A solo singing contest for senior high students. Each singer performs one OPM song.';

export default function AiCriteriaSuggest({ setCriteria }) {
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const suggest = async () => {
    const desc = description.trim();
    if (desc.length < 3) {
      setError('Describe the event first (at least a few words).');
      return;
    }
    setLoading(true);
    setError('');
    setApplied(false);
    try {
      const res = await apiClient.post('/suggest-criteria', { description: desc });
      const list = Array.isArray(res?.criteria) ? res.criteria : [];
      if (!list.length) {
        setError('The AI did not return any criteria. Please try again.');
        setRows([]);
      } else {
        setRows(list.map((c, i) => ({
          id: `ai-${i}`,
          name: c.name,
          description: c.description || '',
          percentage: Number(c.percentage) || 0,
        })));
      }
    } catch (err) {
      setError(err.message || 'Could not get suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Copy suggestions into the criteria list for editing (items use `weight`).
  const useAndEdit = () => {
    setCriteria(rows.map((r, i) => ({
      id: `ai-${Date.now()}-${i}`,
      name: String(r.name || '').trim() || `Criterion ${i + 1}`,
      weight: Number(r.percentage) || 0,
    })));
    setApplied(true);
  };

  const reject = () => {
    setRows([]);
    setError('');
    setApplied(false);
  };

  return (
    <div className="ai-ui-font w-full max-w-[520px]">
      {/* Heading */}
      <h2 className="text-[28px] font-bold leading-tight text-[var(--text1)]">AI Prompt</h2>
      <p className="mt-1 text-[14px] text-[var(--text2)]">
        The AI only suggests. You decide what to keep. The AI never scores or ranks.
      </p>

      {/* Main card */}
      <div
        className="mt-6 rounded-2xl p-5 shadow-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={20} style={{ color: 'var(--purple)' }} />
          <span className="text-base font-semibold text-[var(--text1)]">Suggest criteria</span>
        </div>

        <label className="mt-4 mb-2 block text-sm font-medium text-[var(--text2)]">
          Describe your event
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setError(''); }}
          disabled={loading}
          className="w-full resize-y rounded-[10px] p-3 text-[15px] leading-relaxed text-[var(--text1)] outline-none transition focus:border-[var(--accent-mid)] focus:ring-2 focus:ring-[var(--accent-lt)]"
          style={{ minHeight: 80, background: 'var(--surface)', border: '1px solid var(--border)' }}
        />

        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-mid)] disabled:opacity-70"
          style={{ cursor: loading ? 'wait' : 'pointer' }}
        >
          <WandSparkles size={16} />
          {loading ? 'Thinking…' : 'Suggest criteria'}
        </button>

        {error ? (
          <div
            className="mt-4 rounded-lg px-3 py-2 text-xs"
            style={{ color: 'var(--red)', background: 'var(--red-lt)', border: '1px solid var(--red)' }}
          >
            {error}
          </div>
        ) : null}
      </div>

      {/* Suggestion panel */}
      {rows.length > 0 && (
        <div
          className="mt-6 rounded-[14px] p-4"
          style={{ background: 'var(--purple-bg)', border: '1px solid var(--purple-bd)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-[var(--text1)]">Suggestion</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                color: 'var(--purple)',
                background: 'var(--purple-lt)',
                border: '1px solid var(--purple-bd)',
              }}
            >
              <Sparkles size={12} /> AI-generated
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-[10px] px-3.5 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[var(--text1)]">{r.name}</div>
                  {r.description ? (
                    <div className="mt-0.5 text-[13px] text-[var(--text2)]">{r.description}</div>
                  ) : null}
                </div>
                <div
                  className="shrink-0 pl-3 text-sm font-bold tabular-nums text-[var(--text1)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {r.percentage}%
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={useAndEdit}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-mid)]"
            >
              <Check size={16} /> Use and edit
            </button>
            <button
              type="button"
              onClick={reject}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--text1)] transition hover:bg-[var(--surface2)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <X size={16} /> Reject
            </button>
          </div>

          {applied ? (
            <div className="mt-3 text-xs font-medium" style={{ color: 'var(--accent-mid)' }}>
              Added to the criteria list below — review and edit, then Save Config.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
