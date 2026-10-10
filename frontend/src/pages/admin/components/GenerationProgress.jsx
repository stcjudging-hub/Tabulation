import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   GenerationProgress
   ---------------------------------------------------------------------------
   Modern 0 → 100% progress bar shown while "Save config" is generating the
   Judge UI (AI Prompt mode AND Default UI mode). NO code / HTML is ever shown.

   Everything you'd normally want to tweak lives in CONFIG below — colors,
   size, timing and the progress model. Nothing else needs to change.
   ───────────────────────────────────────────────────────────────────────── */
// Easy-to-tweak look & feel — edit CONFIG here (kept local so this stays a
// pure component file). Change any value to restyle/retime the progress bar.
const CONFIG = {
  // ── geometry ──
  barHeight: 14,
  barRadius: 999,
  cardRadius: 12,

  // ── colors (system theme tokens; swap for any CSS color) ──
  track:     'var(--surface2)',
  fill:      'linear-gradient(90deg, var(--accent) 0%, var(--accent-mid) 55%, var(--gold) 100%)',
  fillDone:  'var(--accent-mid)',
  fillError: 'var(--red)',

  // ── progress model ──
  // The stream gives no real percentage, so we blend two estimates:
  //  • time  — eases toward `timeCeiling` (never 100 until finished)
  //  • chars — streamed length / `expectedChars`
  timeCeiling:    95,
  timeHalfLifeMs: 2400,
  charCeiling:    88,
  expectedChars:  9000,
  tickMs:         120,
  smoothMs:       260,
};

export default function GenerationProgress({
  variant = 'modal',
  open = true,
  status = 'streaming',        // 'streaming' | 'done' | 'error' | 'idle'
  text = '',
  error = '',
  model = '',
  startedAt = null,
  cached = false,
  generationId = null,
  onClose = null,
  title = 'Generating Judge UI',
}) {
  const [now, setNow] = useState(() => Date.now());
  const [autoPct, setAutoPct] = useState(0);

  const startRef = useRef(startedAt);
  const lenRef   = useRef((text || '').length);
  useEffect(() => { startRef.current = startedAt; }, [startedAt]);
  useEffect(() => { lenRef.current = (text || '').length; }, [text]);

  const streaming = status === 'streaming';

  // elapsed clock (only ticks while streaming)
  useEffect(() => {
    if (!streaming || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [streaming, startedAt]);

  // progress estimator (only runs while streaming; done/error resolve to 100)
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => {
      const elapsed = startRef.current ? Date.now() - startRef.current : 0;
      const timePct = CONFIG.timeCeiling * (1 - Math.exp(-elapsed / CONFIG.timeHalfLifeMs));
      const charPct = CONFIG.charCeiling * Math.min(1, lenRef.current / CONFIG.expectedChars);
      setAutoPct(Math.max(0, Math.min(CONFIG.timeCeiling, Math.max(timePct, charPct))));
    }, CONFIG.tickMs);
    return () => clearInterval(id);
  }, [streaming]);

  // derived value: streaming → estimator, done/error → 100%, idle → 0
  const pct = status === 'done' || status === 'error' ? 100 : streaming ? autoPct : 0;

  const elapsed = (status !== 'idle' && startedAt)
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;

  const isError = status === 'error';
  const isDone  = status === 'done';

  const statusLabel =
    isDone  ? (cached ? 'Loaded from cache — ready instantly' : 'Done — saved to ui_cache')
    : isError ? (error || 'Generation failed')
    : cached ? 'Found cached design'
    : 'Generating…';

  const fillBackground = isError ? CONFIG.fillError : isDone ? CONFIG.fillDone : CONFIG.fill;

  const card = (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: CONFIG.cardRadius,
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        color: 'var(--text1)',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 18px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0,
          background: isError ? 'var(--red)' : isDone ? 'var(--accent-mid)' : 'var(--gold)',
          animation: streaming ? 'gp-pulse 1s ease-in-out infinite' : 'none' }} />
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.02em' }}>{title}</span>
        {model && <span style={{ color: 'var(--text3)', fontSize: 12 }}>· {model}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
          {status !== 'idle' && startedAt ? `${elapsed}s` : ''}
        </span>
        {generationId && <span style={{ color: 'var(--text3)', fontSize: 10 }}>id {String(generationId).slice(0, 8)}</span>}
      </div>

      {/* body */}
      <div style={{ padding: '18px 18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {isError ? 'Failed' : isDone ? 'Complete' : 'Progress'}
          </span>
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: isError ? 'var(--red)' : isDone ? 'var(--accent-mid)' : 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(pct)}<span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)', marginLeft: 2 }}>%</span>
          </span>
        </div>

        {/* track */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          style={{ height: CONFIG.barHeight, borderRadius: CONFIG.barRadius, background: CONFIG.track, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: CONFIG.barRadius,
              background: fillBackground,
              transition: `width ${CONFIG.smoothMs}ms cubic-bezier(.22,.61,.36,1)`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* moving sheen while streaming */}
            {streaming && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)', transform: 'translateX(-100%)', animation: 'gp-sheen 1.25s linear infinite' }} />
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: isError ? 'var(--red)' : 'var(--text2)', fontWeight: isError ? 600 : 400 }}>
          {isError ? `✗ ${statusLabel}` : isDone ? `✓ ${statusLabel}${cached ? '' : ''}.` : statusLabel}
        </div>
      </div>

      {/* footer / actions */}
      {(variant === 'modal' || isDone || isError) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>
            {streaming ? 'The judge page updates automatically once this finishes' : isDone ? 'Your judges can now load this design' : 'Close to try again'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              style={{ fontSize: 12, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text1)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {streaming ? 'Stop' : 'Close'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const keyframes = (
    <style>{`
      @keyframes gp-pulse { 50% { opacity: 0.3 } }
      @keyframes gp-sheen { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }
    `}</style>
  );

  if (variant === 'inline') return open ? <>{keyframes}{card}</> : null;

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', padding: 16 }}>
      <div style={{ width: 'min(520px, 100%)' }}>{card}</div>
      {keyframes}
    </div>
  );
}
