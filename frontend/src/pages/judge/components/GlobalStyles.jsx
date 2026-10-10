export function GlobalStyles() {
  return (
    <style>{`
      @keyframes spin  { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

      @keyframes hint-scroll {
        0%   { transform: translateX(0); opacity: 0.7; }
        60%  { transform: translateX(5px); opacity: 1; }
        100% { transform: translateX(0); opacity: 0.7; }
      }

      /* ── Criteria weight bar grow-in ── */
      @keyframes ci-bar-grow {
        from { width: 0; }
      }
      .ci-bar-fill {
        animation: ci-bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* ── AI-rendered content: let the scoring table define its own layout ──
         The table ships with its own fixed, aligned design (.sts-table), so we
         only guard the scroll wrapper and force sensible overflow behaviour. */
      .ai-scroll-container {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
      }
      .ai-scroll-container::-webkit-scrollbar        { height: 4px; }
      .ai-scroll-container::-webkit-scrollbar-track  { background: transparent; }
      .ai-scroll-container::-webkit-scrollbar-thumb  { background: #cbd5e1; border-radius: 999px; }

      .ai-rendered-content {
        font-size: clamp(11px, 1.8vw, 14px);
        display: block;
        min-width: 100%;
        width: 100%;
      }
      /* The generated wrapper must fill the parent container horizontally and hug
         its content vertically — never cap width with max-w-* and never force
         full viewport height with min-h-screen. */
      .ai-rendered-content > div {
        width: 100% !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      .ai-rendered-content table {
        width: 100%;
        max-width: 100%;
      }
      .ai-rendered-content td,
      .ai-rendered-content th {
        white-space: nowrap;
        overflow-wrap: normal;
        box-sizing: border-box;
      }
      /* The rich static table ships its own min-width (the exact sum of its
         fixed column widths) and must be allowed to overflow its .sts-scroll
         wrapper so judges can scroll it horizontally on phones.
         Never force min-width:0 here — that squeezes the fixed-width columns
         into a broken, overlapping layout on narrow screens. */
      .ai-rendered-content .sts-table {
        width: 100% !important;
        table-layout: fixed !important;
      }
      /* The No./Name cells must NEVER be pinned. An older cached design can
         still ship the sticky-first-column rules, which on phones pins No. +
         Name and leaves only the criteria column scrollable (so the score
         dropdowns look cut). Neutralize the pin regardless of the cached CSS. */
      .ai-rendered-content .sts-table .sts-sticky {
        position: static !important;
        left: auto !important;
      }
      .ai-rendered-content .sts-table .sts-sticky-name {
        box-shadow: none !important;
      }
      .ai-rendered-content .sts-table thead th.sts-sticky {
        z-index: auto !important;
      }
      .ai-rendered-content .sts-wrap {
        width: auto !important;
        min-width: 0 !important;
      }
      .ai-rendered-content .sts-table td,
      .ai-rendered-content .sts-table th {
        height: auto !important;
      }

      .scroll-hint { display: none; }
      @media (max-width: 639px) {
        .scroll-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 6px 14px 2px;
          animation: hint-scroll 1.8s ease-in-out infinite;
        }
      }
    `}</style>
  );
}