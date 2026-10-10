// Shared deterministic judge table builder — used by both admin preview and judge page.
// Keeps styling 100% identical so "what you see in preview" === "what judges get".
//
// Theme is locked to the Admin Login screen (pages/AdminLogin.jsx):
//   primary   #1B4332   (deep green)
//   accent    #C9A227   (gold)
//   surface   #FFFFFF / #FBFCF9
//   input     #F3F6F1  on border #BBCABB
//   divider   #E1E8DE
//   text      #14201A (strong) / #4B5A4D (secondary) / #6C7A71 (muted)
//   radius    rounded-sm (4px) — matches every input/button on the login screen
//   focus     border #1B4332 + ring rgba(27,67,50,0.15), bg flips to white
//   font      Inter
//
// The score control is a real native <select class="score-dropdown" id="score-{c}-{cr}">
// styled with CSS to match the theme. Its popup list is rendered by the browser in
// its own overlay, so it is inherently adaptive (the browser flips it up/down around
// the viewport) and can never overlap the table layout.

export function buildStaticJudgeTable(contestants, criteria, judgeName = 'Judge 1') {
  if (!Array.isArray(contestants) || !Array.isArray(criteria)) return '';
  if (!contestants.length || !criteria.length) return '';
  const maxBy = {};
  criteria.forEach(c => {
    if (c && c.id !== undefined && c.id !== null) maxBy[String(c.id)] = Number(c.percentage) || 0;
  });

  const escAttr = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const initial = escAttr(String(judgeName || 'J').trim().charAt(0).toUpperCase() || 'J');

  // ── Adaptive density ─────────────────────────────────────────────────
  // Few criteria → roomy columns like the current layout. Many criteria →
  // compress column widths, padding and the score dropdown together so the
  // table fits without an inner horizontal scroll that piles up, growing
  // only the bare minimum a dropdown needs.
  const count    = criteria.length;
  const dense    = count >= 6;
  const heavy    = count >= 10;
  const nameW    = dense ? (heavy ? 140 : 160) : 200;
  const totW     = dense ? (heavy ? 80  : 88 ) : 100;
  const rankW    = dense ? (heavy ? 68  : 76 ) : 84;
  const fixedW   = 60 + nameW + totW + rankW;            // num + name + total + rank
  const critW    = dense ? Math.max(56, Math.floor((1080 - fixedW) / count)) : 132;
  const tableMin = 60 + nameW + totW + rankW + critW * count;
  const ddW      = dense ? Math.max(70, Math.min(76, critW - 6)) : 76;
  const ddH      = dense ? 32 : 38;

  const densityCss = dense ? `
    .sts-table { min-width: ${tableMin}px; }
    .sts-table thead th.sts-col-crit { width: ${critW}px; }
    .sts-table thead th.sts-col-name { width: ${nameW}px; }
    .sts-table thead th.sts-col-tot  { width: ${totW}px; }
    .sts-table thead th.sts-col-rank { width: ${rankW}px; }
    .sts-table thead th.sts-th { padding: 8px 5px; font-size: 9px; }
    .sts-crit-name { font-size: 10px; line-height: 1.25; }
    .sts-weight-track { width: 30px; }
    .sts-pct { font-size: 9px; }
    .sts-table tbody td { padding: 7px 5px; font-size: 12px; }
    .sts-dd-wrap select.score-dropdown { width: ${ddW}px; height: ${ddH}px; padding: 0 22px 0 6px; font-size: 12px; background-position: right 6px center; }
    .sts-tot-chip { min-width: 46px; height: 26px; font-size: 12px; }
    .sts-rank-pill { min-width: 26px; height: 26px; font-size: 11px; }
  ` : '';

  const head = criteria.map(c => {
    const pct = Number(c.percentage) || 0;
    return `<th class="sts-th sts-col-crit">` +
      `<div class="sts-crit-inner">` +
        `<span class="sts-crit-name">${String(c.name || '')}</span>` +
        `<div class="sts-weight-track"><div class="sts-weight-fill" style="width:${Math.min(pct, 100)}%"></div></div>` +
        `<span class="sts-pct">${pct}%</span>` +
      `</div>` +
    `</th>`;
  }).join('');

  // Native <select> options — highest first so the current percentage is on top,
  // each labelled with its percentage (25 → "25%"), matching the criterion weight.
  const nativeOptionString = (max) => {
    let out = '<option value="" data-placeholder="true">–</option>';
    for (let i = max; i >= 0; i--) out += `<option value="${i}">${i}%</option>`;
    return out;
  };

  const buildDropdown = (id, ariaLabel, max) => {
    return `<div class="sts-dd-wrap">` +
      `<select class="score-dropdown" id="${id}" aria-label="${escAttr(ariaLabel)}">` +
        nativeOptionString(max) +
      `</select>` +
    `</div>`;
  };

  const rows = contestants.map((c, idx) => {
    const cells = criteria.map(cr => {
      const max = maxBy[String(cr.id)] ?? 100;
      return `<td class="sts-td-stc">` +
        buildDropdown(`score-${c.id}-${cr.id}`, `${cr.name || ''} score for ${c.name || ''}`, max) +
      `</td>`;
    }).join('');

    return `<tr class="sts-tr">` +
      `<td class="sts-td-num sts-sticky sts-sticky-num"><span class="sts-num-pill">${Number(c.entry_number) || (idx + 1)}</span></td>` +
      `<td class="sts-td-name sts-sticky sts-sticky-name"><span class="sts-name-text">${String(c.name || '')}</span></td>` +
      cells +
      `<td class="sts-td-tot"><span class="sts-tot-chip" id="total-${c.id}">0</span></td>` +
      `<td class="sts-td-rank"><span class="sts-rank-pill" id="rank-${c.id}">–</span></td>` +
      `</tr>`;
  }).join('');

  const css = `
    /* ---------- tokens (scoped) ---------- */
    .sts-table-wrap {
      --c-primary: #1B4332;
      --c-primary-tint: rgba(27, 67, 50, 0.07);
      --c-primary-tint-strong: rgba(27, 67, 50, 0.16);
      --c-ring: rgba(27, 67, 50, 0.15);
      --c-accent: #C9A227;
      --c-accent-tint: rgba(201, 162, 39, 0.14);
      --c-silver: #8A93A6;
      --c-silver-tint: rgba(138, 147, 166, 0.14);
      --c-bronze: #B4783F;
      --c-bronze-tint: rgba(180, 120, 63, 0.14);
      --c-surface: #FFFFFF;
      --c-surface-alt: #FBFCF9;
      --c-input: #F3F6F1;
      --c-input-border: #BBCABB;
      --c-divider: #E1E8DE;
      --c-divider-soft: #EEF2EE;
      --c-text: #14201A;
      --c-text-soft: #4B5A4D;
      --c-text-muted: #6C7A71;
      --r-input: 4px;   /* matches rounded-sm on the login screen */
      --r-md: 10px;
      --r-lg: 14px;
      --r-pill: 999px;
      --sp-1: 4px;
      --sp-2: 8px;
      --sp-3: 12px;
      --sp-4: 16px;
      --sp-5: 20px;
      --sp-6: 24px;
      box-sizing: border-box;
    }
    .sts-table-wrap *, .sts-table-wrap *::before, .sts-table-wrap *::after {
      box-sizing: border-box;
    }

    /* ---------- shell ---------- */
    .sts-shell {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid var(--c-divider);
      border-radius: var(--r-lg);
      background: var(--c-surface);
      overflow: hidden;
      box-shadow:
        0 1px 1px rgba(20, 32, 26, 0.03),
        0 4px 8px rgba(20, 32, 26, 0.04),
        0 20px 40px -12px rgba(20, 32, 26, 0.14);
      margin-bottom: var(--sp-6);
    }
    .sts-accent {
      height: 3px;
      background: linear-gradient(90deg, var(--c-primary) 0%, var(--c-accent) 100%);
    }

    /* ---------- header ---------- */
    .sts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
      background: var(--c-surface-alt);
      border-bottom: 1px solid var(--c-divider);
    }
    .sts-header-left { min-width: 0; }
    .sts-eyebrow {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: 6px;
    }
    .sts-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--c-accent);
      flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--c-accent-tint);
      animation: sts-pulse 2.4s ease-in-out infinite;
    }
    @keyframes sts-pulse {
      0%, 100% { box-shadow: 0 0 0 3px var(--c-accent-tint); }
      50% { box-shadow: 0 0 0 5px var(--c-accent-tint); }
    }
    .sts-eyebrow-text {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--c-text-muted);
    }
    .sts-title {
      margin: 0;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--c-text);
      line-height: 1.25;
    }
    .sts-subtitle {
      margin: 3px 0 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--c-text-muted);
    }
    .sts-subtitle strong {
      color: var(--c-text-soft);
      font-weight: 700;
    }

    .sts-judge-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-4) var(--sp-1) var(--sp-1);
      border-radius: var(--r-pill);
      background: var(--c-surface);
      border: 1px solid var(--c-divider);
      box-shadow: 0 1px 2px rgba(20, 32, 26, 0.05);
      flex-shrink: 0;
    }
    .sts-judge-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(155deg, var(--c-primary) 0%, #0F2A1D 100%);
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      flex-shrink: 0;
    }
    .sts-judge-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      line-height: 1.15;
      text-align: center;
    }
    .sts-judge-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--c-text-muted);
    }
    .sts-judge-name {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--c-text);
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    /* ---------- table scroll ----------
       Horizontal only. The table grows to its natural height and the PAGE
       scrolls vertically — no inner scrollbar — so judges never fight a
       nested Y-scroll while scoring. */
    .sts-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      position: relative;
    }
    .sts-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
    .sts-scroll::-webkit-scrollbar-track { background: var(--c-surface-alt); }
    .sts-scroll::-webkit-scrollbar-thumb { background: var(--c-input-border); border-radius: var(--r-md); border: 2px solid var(--c-surface-alt); }
    .sts-scroll::-webkit-scrollbar-thumb:hover { background: #9FB0A0; }

    /* ---------- table ---------- */
    .sts-table {
      width: 100%;
      min-width: ${tableMin}px;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
      background: var(--c-surface);
      font-size: 13px;
      color: var(--c-text);
    }

    /* ---------- head ---------- */
    .sts-table thead th.sts-th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: var(--c-surface-alt);
      border-bottom: 2px solid var(--c-primary);
      padding: var(--sp-4) var(--sp-3);
      text-align: center;
      vertical-align: middle;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--c-text-soft);
    }
    .sts-table thead th.sts-col-name {
      text-align: center;
      padding-left: 0;
    }

    .sts-crit-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }
    .sts-crit-name {
      display: block;
      width: 100%;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-transform: none;
      color: var(--c-text);
      word-break: break-word;
      text-align: center;
      line-height: 1.3;
    }
    .sts-weight-track {
      width: 48px;
      height: 4px;
      border-radius: var(--r-pill);
      background: var(--c-divider-soft);
      overflow: hidden;
    }
    .sts-weight-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--c-accent), #E0BA4A);
      border-radius: var(--r-pill);
    }
    .sts-pct {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--c-text-muted);
    }

    /* ---------- column widths ---------- */
    .sts-col-num { width: 60px; }
    .sts-col-name { width: 200px; }
    .sts-col-crit { width: 132px; }
    .sts-col-tot { width: 100px; }
    .sts-col-rank { width: 84px; }

    /* ---------- first columns scroll normally (NOT pinned) ----------
       No. and Name used to be horizontally sticky, which fought the phone
       scroll (pinned columns + hardcoded left offsets). They now scroll with
       the rest of the row so horizontal scrolling is clean everywhere. */
    .sts-sticky {
      position: static;
      background: inherit;
    }

    /* ---------- body ---------- */
    .sts-table tbody tr { position: relative; }
    .sts-table tbody td {
      padding: var(--sp-3) var(--sp-3);
      border-bottom: 1px solid var(--c-divider-soft);
      text-align: center;
      vertical-align: middle;
      font-size: 13px;
      color: var(--c-text);
      background: var(--c-surface);
      transition: background-color 0.15s ease;
    }
    .sts-table tbody tr:last-child td { border-bottom: none; }
    .sts-table tbody tr:nth-child(even) td { background: var(--c-surface-alt); }

    .sts-table tbody tr:hover td { background: var(--c-primary-tint); }
    .sts-table tbody tr td.sts-sticky-num { border-left: 3px solid transparent; }
    .sts-table tbody tr:hover td.sts-sticky-num { border-left: 3px solid var(--c-accent); }

    .sts-num-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 25px;
      height: 25px;
      padding: 0 6px;
      border-radius: var(--r-pill);
      background: var(--c-input);
      color: var(--c-text-muted);
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .sts-td-name {
      text-align: center;
      overflow: hidden;
    }
    .sts-name-text {
      display: block;
      font-weight: 650;
      color: var(--c-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sts-tot-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 56px;
      height: 30px;
      padding: 0 var(--sp-3);
      border-radius: var(--r-md);
      background: var(--c-primary-tint-strong);
      border: 1px solid rgba(27, 67, 50, 0.12);
      color: var(--c-primary);
      font-weight: 800;
      font-size: 13.5px;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .sts-rank-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 30px;
      padding: 0 var(--sp-2);
      border-radius: var(--r-pill);
      background: var(--c-surface);
      color: var(--c-text-soft);
      font-size: 11.5px;
      font-weight: 700;
      border: 1px solid var(--c-divider);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .sts-rank-pill.sts-rank-1 { background: var(--c-accent-tint); color: #8A6C15; border-color: rgba(201,162,39,0.4); box-shadow: 0 0 0 3px rgba(201,162,39,0.08); }
    .sts-rank-pill.sts-rank-2 { background: var(--c-silver-tint); color: #5B6479; border-color: rgba(138,147,166,0.4); }
    .sts-rank-pill.sts-rank-3 { background: var(--c-bronze-tint); color: #8A5A2E; border-color: rgba(180,120,63,0.4); }

    /* ---------- score control (real native <select>, styled) ---------- */
    .sts-td-stc { text-align: center; }
    .sts-dd-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .sts-dd-wrap select.score-dropdown {
      width: 76px;
      height: 38px;
      padding: 0 28px 0 11px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: var(--c-text);
      background: var(--c-input);
      border: 1px solid var(--c-input-border);
      border-radius: var(--r-input);
      cursor: pointer;
      text-align: center;
      text-align-last: center;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%236C7A71' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
    }
    .sts-dd-wrap select.score-dropdown:hover {
      border-color: #9FB0A0;
    }
    .sts-dd-wrap select.score-dropdown:focus {
      outline: none;
      border-color: var(--c-primary);
      background-color: var(--c-surface);
      box-shadow: 0 0 0 3px var(--c-ring);
    }
    .sts-dd-wrap select.score-dropdown option {
      font-weight: 600;
      color: var(--c-text);
      background: var(--c-surface);
    }

    /* ---------- footer ---------- */
    .sts-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-6);
      background: var(--c-surface-alt);
      border-top: 1px solid var(--c-divider);
      font-size: 11px;
      color: var(--c-text-muted);
    }
    .sts-footer-left {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .sts-footer-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--c-primary);
      flex-shrink: 0;
    }
    .sts-footer-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--c-text-muted);
      padding: 3px 9px;
      border-radius: var(--r-pill);
      background: var(--c-surface);
      border: 1px solid var(--c-divider);
    }

    /* ---------- small screens ---------- */
    @media (max-width: 768px) {
      .sts-header { flex-wrap: wrap; padding: var(--sp-4); }
      .sts-table thead th.sts-th { padding: var(--sp-3) var(--sp-2); }
      .sts-table tbody td { padding: var(--sp-2) var(--sp-2); }
      .sts-table thead th.sts-col-name { padding-left: var(--sp-4); }
      .sts-td-name { padding-left: var(--sp-4); }
      .sts-dd-wrap select.score-dropdown {
        width: 64px;
        height: 34px;
        padding: 0 26px 0 9px;
        font-size: 12px;
        background-position: right 9px center;
      }
      .sts-footer { padding: var(--sp-2) var(--sp-4); flex-wrap: wrap; }
    }
  `;

  return `<style>${css}${densityCss}</style>` +
    `<div class="sts-shell sts-table-wrap">` +
      `<div class="sts-accent"></div>` +
      `<div class="sts-header">` +
        `<div class="sts-header-left">` +
          `<div class="sts-eyebrow"><span class="sts-dot"></span><span class="sts-eyebrow-text">Scoring Terminal · Live</span></div>` +
          `<h3 class="sts-title">Live Scoring</h3>` +
          `<p class="sts-subtitle"><strong>${contestants.length}</strong> Contestants · <strong>${criteria.length}</strong> Criteria</p>` +
        `</div>` +
        `<div class="sts-judge-chip">` +
          `<span class="sts-judge-avatar">${initial}</span>` +
          `<span class="sts-judge-meta">` +
            `<span class="sts-judge-label">Judge</span>` +
            `<span class="sts-judge-name">${escAttr(judgeName)}</span>` +
          `</span>` +
        `</div>` +
      `</div>` +
      `<div class="sts-scroll">` +
        `<table class="sts-table">` +
          `<thead><tr>` +
            `<th class="sts-th sts-col-num sts-sticky sts-sticky-num">No.</th>` +
            `<th class="sts-th sts-col-name sts-sticky sts-sticky-name">Name</th>` +
            head +
            `<th class="sts-th sts-col-tot">Total</th>` +
            `<th class="sts-th sts-col-rank">Rank</th>` +
          `</tr></thead>` +
          `<tbody>${rows}</tbody>` +
        `</table>` +
      `</div>` +
      `<div class="sts-footer">` +
        `<div class="sts-footer-left"><span class="sts-footer-dot"></span><span>Scores save automatically as you enter them</span></div>` +
        `<span class="sts-footer-badge">Scroll for more →</span>` +
      `</div>` +
    `</div>`;
}