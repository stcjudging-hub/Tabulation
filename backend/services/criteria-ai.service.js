// ── AI-suggested criteria ────────────────────────────────────────────────────
// The admin describes the event in plain language (e.g. "folk dance contest for
// Grade 10"). The LLM proposes scoring criteria whose weights sum to exactly
// 100. This module builds the prompt, calls the shared AI service with the
// school's own provider/model, and parses + normalizes the model's JSON so the
// admin only ever sees clean, ready-to-edit rows. Nothing is persisted here —
// the admin reviews the suggestions and saves them through the normal
// /save-config flow.

const HttpError = require('../utils/http-error');
const aiService = require('../ai/ai-service');
const { resolveAiConfig } = require('./ai-config.service');

const MIN_CRITERIA = 3;
const MAX_CRITERIA = 8;
const MAX_DESCRIPTION = 2000;

// Largest-remainder rounding: scales any positive numbers so the integer
// percentages add up to exactly 100, distributing the leftover points to the
// entries with the largest fractional parts. Never drops a criterion to 0%.
function normalizeWeights(items) {
  const cleaned = items
    .map((it) => ({ name: String(it?.name || '').trim(), percentage: Number(it?.percentage) }))
    .filter((it) => it.name && Number.isFinite(it.percentage) && it.percentage > 0)
    .slice(0, MAX_CRITERIA);

  if (!cleaned.length) return [];

  const total = cleaned.reduce((s, it) => s + it.percentage, 0);
  if (total <= 0) return [];

  const scaled = cleaned.map((it) => ({ ...it, exact: (it.percentage / total) * 100 }));
  const result = scaled.map((it) => ({ name: it.name, percentage: Math.floor(it.exact) }));

  let remainder = 100 - result.reduce((s, it) => s + it.percentage, 0);
  const order = scaled
    .map((it, i) => ({ i, frac: it.exact - Math.floor(it.exact) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remainder; k += 1) {
    result[order[k].i].percentage += 1;
  }

  return result;
}

// Extracts the first JSON object or array from a possibly noisy LLM response,
// tolerating markdown code fences and leading/trailing prose.
function extractJson(text) {
  const s = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();

  const candidates = [];
  const objStart = s.indexOf('{');
  const objEnd = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) candidates.push(s.slice(objStart, objEnd + 1));

  const arrStart = s.indexOf('[');
  const arrEnd = s.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(s.slice(arrStart, arrEnd + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function buildPrompt(description) {
  return `
You are an expert contest tabulation consultant. Read the event description and propose fair, well-balanced scoring criteria that a panel of judges could use.

[EVENT DESCRIPTION]
"""${description}"""

[RULES]
- Propose between ${MIN_CRITERIA} and ${MAX_CRITERIA} criteria that fit this specific event.
- Each criterion has a short, clear name (2 to 4 words).
- Each criterion has a percentage weight. Weights are positive numbers and MUST add up to exactly 100.
- Order the criteria from most important to least important.
- Do NOT include descriptions, explanations, comments, or markdown.

[OUTPUT FORMAT]
Return ONLY valid JSON in exactly this shape (no code fences, no extra text):
{"criteria":[{"name":"Criterion name","percentage":25},{"name":"Another criterion","percentage":20}]}
  `.trim();
}

// Main entry: describe → validated, normalized criteria list.
async function suggestCriteria(schoolId, description) {
  const desc = String(description || '').trim();
  if (desc.length < 3) {
    throw new HttpError(400, 'Please describe the event first.');
  }
  if (desc.length > MAX_DESCRIPTION) {
    throw new HttpError(400, `Event description is too long (max ${MAX_DESCRIPTION} characters).`);
  }

  const { provider, model } = await resolveAiConfig(schoolId);

  let raw;
  try {
    raw = await aiService.generate({ provider, model, prompt: buildPrompt(desc) });
  } catch (err) {
    const status = err && err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    throw new HttpError(status, err?.message || 'The AI could not propose criteria right now. Please try again.');
  }

  const parsed = extractJson(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.criteria;
  if (!Array.isArray(list) || !list.length) {
    throw new HttpError(502, 'The AI returned an unreadable response. Please try again.');
  }

  const criteria = normalizeWeights(list);
  if (!criteria.length) {
    throw new HttpError(502, 'The AI did not return any usable criteria. Please try again.');
  }

  console.log(`🧠 [criteria-ai] school=${schoolId} provider=${provider} model=${model} criteria=${criteria.length} description="${desc.slice(0, 60)}"`);
  return { description: desc, criteria, provider, model };
}

module.exports = { suggestCriteria, normalizeWeights, extractJson };
