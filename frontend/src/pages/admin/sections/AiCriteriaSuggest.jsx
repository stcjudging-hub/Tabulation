import React, { useState } from 'react';
import { Brain, X, Check } from 'lucide-react';
import apiClient from '../../../services/api';
import { card } from './card.js';

// ── AI-suggested criteria ────────────────────────────────────────────────────
// The admin describes the event; the backend asks the school's AI provider for
// a criteria set whose weights total 100. The suggestions appear below as
// editable rows the admin can tweak, then Apply (replaces the criteria list) or
// Discard. Nothing is saved until the admin hits Save Config as usual.
export default function AiCriteriaSuggest({ setCriteria, contestName }) {
  const [description, setDescription] = useState('');
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [applied, setApplied]         = useState(false);

  const total = rows.reduce((s, r) => s + Number(r.weight || 0), 0);

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
        setRows(list.map((c, i) => ({ id: `ai-${i}`, name: c.name, weight: c.percentage })));
      }
    } catch (err) {
      setError(err.message || 'Could not get suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id
      ? { ...r, [field]: field === 'weight' ? Math.max(0, Number(value) || 0) : value }
      : r)));
    setApplied(false);
  };

  const apply = () => {
    setCriteria(rows.map((r, i) => ({
      id: `ai-${Date.now()}-${i}`,
      name: String(r.name || '').trim() || `Criterion ${i + 1}`,
      weight: Number(r.weight) || 0,
    })));
    setApplied(true);
  };

  const discard = () => {
    setRows([]);
    setError('');
    setApplied(false);
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-lt)', color: 'var(--accent)', border: '1px solid var(--accent-bd)',
        }}>
          <Brain size={15} />
        </span>
        <div>
          <div className="section-heading" style={{ margin: 0 }}>AI Suggested Criteria</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Describe your event and let the AI propose criteria with weights that total 100%.
          </div>
        </div>
      </div>

      <textarea
        className="field-input"
        style={{ minHeight: 74, resize: 'vertical' }}
        placeholder='e.g. "Folk dance contest for Grade 10 — judged on choreography, cultural authenticity, synchronization, costume, and stage presence."'
        value={description}
        onChange={(e) => { setDescription(e.target.value); setError(''); }}
        disabled={loading}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            fontFamily: 'inherit', cursor: loading ? 'wait' : 'pointer',
            border: '1.5px solid var(--accent)', background: 'var(--accent)', color: '#fff',
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? 'Thinking…' : 'Suggest with AI'}
        </button>
        {contestName ? (
          <button
            type="button"
            onClick={() => setDescription(contestName)}
            disabled={loading}
            style={{
              padding: '9px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)',
            }}
          >
            Use contest name
          </button>
        ) : null}
      </div>

      {error ? (
        <div style={{
          fontSize: 12, color: '#b91c1c', background: '#fee2e2',
          border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px',
        }}>
          {error}
        </div>
      ) : null}

      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text3)',
          }}>
            <span>Proposed criteria — edit before applying</span>
            <span style={{ color: total === 100 ? 'var(--accent)' : '#b45309' }}>{total}%</span>
          </div>

          {rows.map((r) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <input
                type="text"
                value={r.name}
                onChange={(e) => updateRow(r.id, 'name', e.target.value)}
                className="bg-transparent border-none p-0 flex-1 outline-none text-sm font-semibold"
                style={{ color: 'var(--text1)' }}
              />
              <input
                type="number"
                value={r.weight}
                onChange={(e) => updateRow(r.id, 'weight', e.target.value)}
                className="w-16 py-1 px-2 rounded-sm border text-right text-sm font-bold outline-none"
                style={{ border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--accent)' }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>%</span>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={apply}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
                border: '1.5px solid var(--accent)', background: 'var(--accent-lt)', color: 'var(--accent)',
              }}
            >
              <Check size={13} /> Apply to criteria
            </button>
            <button
              type="button"
              onClick={discard}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)',
              }}
            >
              <X size={13} /> Discard
            </button>
          </div>

          {applied && (
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              Applied — the criteria list below now holds the AI suggestions. Review and edit, then Save Config.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
