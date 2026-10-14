# TODO — Admin Criteria redesign

Status legend: `[x]` done · `[~]` in progress · `[ ]` not started

## Layout pass (current)
- [x] Diagnose spacing collision (AI block flush against "Quick start — full presets")
- [x] Diagnose width mismatch (520px block above full-width matrix)
- [x] Decide layout with user: **two-column desktop, stacked mobile**
- [x] Restructure Criteria section into a responsive grid (`sectionRender.jsx`)
- [x] Make the AI tool sticky in its left column on desktop
- [x] Use Plus Jakarta Sans for the section (percentages stay monospace)
- [x] Verify lint clean + production build passes
- [ ] Visual check on dev server (wide + mobile) — awaiting your look

## Earlier pass (visual redesign)
- [x] Add purple theme tokens for light + dark (`index.css`)
- [x] Rebuild heading: "AI Prompt" + subtitle
- [x] Rebuild main card: Sparkles header, textarea, green "Suggest criteria" button
- [x] Rebuild suggestion panel: "Suggestion" header, "✦ AI-generated" pill, rows with monospace %
- [x] Wire "Use and edit" → criteria list (`weight`), "Reject" → hide panel
- [x] Keep backend `POST /suggest-criteria` + `setCriteria` integration

## AI tab (`?tab=ai`) layout pass
- [x] Analyze `AIConfigSection.jsx`
- [x] Confirm layout with user: two-column workspace + collapsed presets
- [x] Mode selector kept as a full-width top-level switch
- [x] Left column (sticky): Provider & Model + AI Design Prompt + quick tags
- [x] Right column: theme presets (6 + "Show all") + generation progress
- [x] Default mode kept single-column (preview uses full width)
- [x] Lint clean + production build passes
- [ ] Visual check on dev server

## Remaining sections — responsive/two-column pass
- [x] Audit all admin sections
- [x] Confirm scope (all) + pattern (two-column desktop, stacked mobile)
- [x] Overview: stats full width · Quick Summary (left) + Scoring Criteria (right) · Danger Zone full width
- [x] System Config: controls + tabs (left, sticky) + Live Preview (right)
- [x] Judges: password + judge count (left, sticky) + calculation type/custom (right)
- [x] Contest Info: name (left) + type (right)
- [x] Contestants: add form (left, sticky) + list (right)
- [x] Lint clean (only pre-existing warnings) + production build passes
- [ ] Visual check at mobile / tablet / desktop

## Open questions / follow-ups
- [ ] AI-generated per-criterion descriptions? Backend currently returns only `name` + `percentage`, so row subtext shows only if present.
- [ ] Confirm breakpoint (two-column starts at `xl` = 1280px).

## Files touched
- `frontend/src/pages/admin/sections/AiCriteriaSuggest.jsx`
- `frontend/src/pages/admin/sections/sectionRender.jsx`
- `frontend/src/pages/admin/sections/AIConfigSection.jsx`
- `frontend/src/pages/admin/sections/OverviewSection.jsx`
- `frontend/src/pages/admin/sections/SystemConfigSection.jsx`
- `frontend/src/pages/admin/sections/JudgeSection.jsx`
- `frontend/src/pages/admin/sections/ContestInfoSection.jsx`
- `frontend/src/pages/admin/sections/ContestantSection.jsx`
- `frontend/src/index.css`
