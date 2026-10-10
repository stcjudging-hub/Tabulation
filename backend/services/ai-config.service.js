// ── Shared AI provider/model resolver ────────────────────────────────────────
// The AI features added on top of the Judge UI generation (criteria suggestions,
// results summary) must use the SAME provider/model the school already selected
// for its contest. This reads that choice from the settings row and coerces it
// to a valid provider/model pair, mirroring judge.service.prepareRender exactly
// so every AI call in the app agrees on the configuration.

const pool = require('../config/db');
const aiModels = require('../ai/ai-models');

// Resolves { provider, model } for a school. Falls back to the platform default
// when the settings row is missing or holds legacy/invalid values.
async function resolveAiConfig(schoolId) {
  const [rows] = await pool.execute(
    'SELECT ai_provider, ai_model FROM settings WHERE school_id = ? LIMIT 1',
    [schoolId]
  );

  const providerEntry = aiModels.getProvider(aiModels.coalesceProvider(rows[0]?.ai_provider));
  const provider = providerEntry ? providerEntry.name : aiModels.DEFAULT_PROVIDER;

  const rawModel = aiModels.coalesceModel(String(rows[0]?.ai_model || aiModels.DEFAULT_MODEL).toLowerCase());
  const model = aiModels.hasModel(provider, rawModel)
    ? rawModel
    : (aiModels.listModels(provider)[0] || aiModels.DEFAULT_MODEL);

  return { provider, model };
}

module.exports = { resolveAiConfig };
