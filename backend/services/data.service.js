const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const aiModels = require('../ai/ai-models');
const { rankValues, numeric } = require('../utils/ranks');
const { PRESENCE_WINDOW_HOURS } = require('./session.service');
const { DEFAULT_PROVIDER, DEFAULT_MODEL, coalesceProvider, coalesceModel } = aiModels;
const { cacheGetJson, cacheSetJson, cacheDel, cacheDelPattern, CACHE_TTL_SECONDS } = require('../utils/mem-cache');
const { addHistory } = require('./history.service');

const allDataKey      = (schoolId) => `public:get-all-data:${schoolId}`;
const systemConfigKey = (schoolId) => `public:system-config:${schoolId}`;
const schoolUiKey     = (schoolId) => `ui:html:${schoolId}:*`;

// ── ACTIVE SCHOOLS (presence-based) ──
// A school counts as ONLINE when at least one device session is alive: not
// logged out, its refresh is unexpired, and its last presence heartbeat is
// within the 24-hour inactivity window. A school with no such session (users
// closed the browser without signing out) is correctly reported as offline.
async function getActiveSchools() {
  const [rows] = await pool.execute(
    `SELECT s.id, s.school_name, s.school_logo, MAX(ss.last_seen) AS last_active_at
       FROM schools s
       JOIN sessions ss
         ON ss.school_id     = s.id
        AND ss.logged_out_at IS NULL
        AND ss.expires_at    > NOW()
        AND ss.last_seen     >= NOW() - INTERVAL 24 HOUR
      WHERE s.status = 'active'
      GROUP BY s.id, s.school_name, s.school_logo
      ORDER BY last_active_at DESC, s.id DESC
      LIMIT 100`
  );

  return {
    count:           rows.length,
    windowMinutes:   PRESENCE_WINDOW_HOURS * 60,
    schools:         rows.map((s) => ({
      id:             s.id,
      school_name:    s.school_name,
      school_logo:    s.school_logo || null,
      last_active_at: s.last_active_at,
    })),
  };
}

// ── SYSTEM CONFIG ──
async function getSystemConfig(schoolId) {
  const key = systemConfigKey(schoolId);
  const cached = await cacheGetJson(key);
  if (cached) return cached;

  const [config] = await pool.execute(
    'SELECT * FROM system_config WHERE school_id = ? ORDER BY id DESC LIMIT 1',
    [schoolId]
  );
  const result = config[0] || {};
  await cacheSetJson(key, result, CACHE_TTL_SECONDS.PUBLIC_SYSTEM_CONFIG);
  return result;
}

// ── ALL CONTEST DATA (settings + contestants + criteria) ──
async function getAllData(schoolId) {
  const key = allDataKey(schoolId);
  const cached = await cacheGetJson(key);
  if (cached) return cached;

  const [settings] = await pool.execute('SELECT * FROM settings WHERE school_id = ? LIMIT 1', [schoolId]);
  const [contestants] = await pool.execute('SELECT * FROM contestants WHERE school_id = ? ORDER BY entry_number ASC', [schoolId]);
  const [criteria] = await pool.execute('SELECT * FROM criteria WHERE school_id = ?', [schoolId]);

  const result = {
    // Coalesce legacy pre-Groq ids ('unorouter'/'codestral-latest') stored in
    // old settings rows so the Admin UI and render paths always see valid ones.
    settings: settings[0]
      ? {
          ...settings[0],
          ai_provider: aiModels.coalesceProvider(settings[0]?.ai_provider) || aiModels.DEFAULT_PROVIDER,
          ai_model:    aiModels.coalesceModel(settings[0]?.ai_model)    || aiModels.DEFAULT_MODEL,
        }
      : { contest_name: 'Event', judge_count: 3 },
    contestants,
    criteria,
  };
  await cacheSetJson(key, result, CACHE_TTL_SECONDS.PUBLIC_ALL_DATA);
  return result;
}

// Invalidates the Redis entries that mirror data written by the writes below.
async function invalidateSchoolCaches(schoolId, { system = false, ui = true } = {}) {
  await cacheDel(allDataKey(schoolId));
  if (system) await cacheDel(systemConfigKey(schoolId));
  if (ui)     await cacheDelPattern(schoolUiKey(schoolId));
}

// ── LEADERBOARD (average or rank-sum) ──
// Returns null when the school has no settings row yet, so callers decide
// how to respond (public route → empty array, protected route → 404).
//
// Rank modes:
//   computation_type = 'average' → rank each contestant's final average
//                                  (midrank ties).
//   computation_type = 'rank'    → per-judge ranks are summed; tied totals
//                                  share a midrank per judge and tied rank-sums
//                                  share a midrank in the final standings.
//   computation_type = 'custom'  → base calc = custom_base ('average' or
//                                  'rank'), ties ranked with
//                                  tie_break_method ('midrank' | 'shared' |
//                                  'sequential').
async function computeLeaderboard(schoolId) {
  const [settings] = await pool.execute(
    `SELECT computation_type, custom_base, tie_break_method, judge_count
       FROM settings
      WHERE school_id = ? LIMIT 1`,
    [schoolId]
  );

  if (!settings[0]) return null;

  const s        = settings[0];
  const base     = s.computation_type === 'custom' ? (s.custom_base || 'average') : s.computation_type;
  const tieBreak = s.computation_type === 'custom' ? (s.tie_break_method || 'midrank') : 'midrank';

  // ── AVERAGE MODE ─────────────────────────────────────────────────────────
  // FIX: divide by COUNT(DISTINCT judge_id) instead of the settings judge_count
  // value. This ensures the average is always correct regardless of how many
  // judges have actually submitted, and works correctly across all schools.
  if (base === 'average') {
    const [results] = await pool.execute(
      `SELECT c.id, c.name, c.entry_number,
              SUM(s.score_value) / COUNT(DISTINCT s.judge_id) AS final_score
       FROM   scores      s
       JOIN   contestants c ON c.id = s.contestant_id AND c.school_id = ?
       WHERE  s.school_id = ?
       GROUP  BY c.id`,
      [schoolId, schoolId]
    );

    const ranked = rankValues(
      results.map(r => ({ ...r, final_score: numeric(r.final_score), value: numeric(r.final_score) })),
      { method: tieBreak, ascending: false }
    );

    return ranked.map(r => ({
      id:            r.id,
      name:          r.name,
      entry_number:  r.entry_number,
      final_score:   r.final_score,
      rank:          r.rank,
    }));
  }

  // ── RANK-SUM MODE ─────────────────────────────────────────────────────────
  const [rawScores] = await pool.execute(
    `SELECT s.judge_id, s.contestant_id, c.name,
            SUM(s.score_value) AS judge_total
     FROM   scores      s
     JOIN   contestants c ON c.id = s.contestant_id AND c.school_id = ?
     WHERE  s.school_id = ?
     GROUP  BY s.judge_id, s.contestant_id`,
    [schoolId, schoolId]
  );

  const judgeScores = {};
  rawScores.forEach(s => {
    if (!judgeScores[s.judge_id]) judgeScores[s.judge_id] = [];
    judgeScores[s.judge_id].push(s);
  });

  const finalTallies = {};
  Object.values(judgeScores).forEach(scores => {
    // Per judge: rank contestants by total with the active tie-break method,
    // so tied totals share a midrank instead of getting sequential positions.
    const ranked = rankValues(
      scores.map(s => ({ ...s, value: numeric(s.judge_total) })),
      { method: tieBreak, ascending: false }
    );
    ranked.forEach(s => {
      if (!finalTallies[s.contestant_id]) {
        finalTallies[s.contestant_id] = { id: s.contestant_id, name: s.name, total_rank: 0 };
      }
      finalTallies[s.contestant_id].total_rank += s.rank;
    });
  });

  // Final standings: lowest rank-sum wins; equal rank-sums share the next
  // available midrank so e.g. two tied sums of 3.5 become 1.5 / 1.5 / 3.
  const final = rankValues(
    Object.values(finalTallies).map(t => ({ ...t, value: numeric(t.total_rank) })),
    { method: tieBreak, ascending: true }
  );

  return final.map(t => ({
    id:           t.id,
    name:         t.name,
    total_rank:   t.total_rank,
    rank:         t.rank,
  }));
}

// ── JUDGE IDS ──
async function getJudgeIds(schoolId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT judge_id
     FROM   scores
     WHERE  school_id = ?
     ORDER  BY judge_id ASC`,
    [schoolId]
  );
  return rows.map(r => r.judge_id);
}

// ── CONTESTANT TOTALS FOR A SINGLE JUDGE ──
async function getJudgeScores(schoolId, judgeId) {
  const [settings] = await pool.execute(
    `SELECT computation_type, tie_break_method FROM settings WHERE school_id = ? LIMIT 1`,
    [schoolId]
  );
  const tieBreak = settings[0]?.computation_type === 'custom'
    ? (settings[0].tie_break_method || 'midrank')
    : 'midrank';

  const [scores] = await pool.execute(
    `SELECT c.id, c.name, c.entry_number, SUM(s.score_value) AS total
     FROM   scores      s
     JOIN   contestants c ON c.id = s.contestant_id AND c.school_id = ?
     WHERE  s.judge_id  = ? AND s.school_id = ?
     GROUP  BY c.id`,
    [schoolId, judgeId, schoolId]
  );

  const ranked = rankValues(
    scores.map(r => ({ ...r, total: numeric(r.total), value: numeric(r.total) })),
    { method: tieBreak, ascending: false }
  );

  return ranked.map(r => ({
    id:           r.id,
    name:         r.name,
    entry_number: r.entry_number,
    total:        r.total,
    rank:         r.rank,
  }));
}

// ── RESET ALL DATA FOR A SCHOOL (transaction) ──
async function resetData(schoolId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM scores       WHERE school_id = ?', [schoolId]);
    await connection.execute('DELETE FROM ui_cache     WHERE school_id = ?', [schoolId]);
    await connection.execute('DELETE FROM contestants  WHERE school_id = ?', [schoolId]);
    await connection.execute('DELETE FROM criteria     WHERE school_id = ?', [schoolId]);
    await connection.execute('DELETE FROM generations  WHERE school_id = ?', [schoolId]);
    await connection.execute(
      `UPDATE settings SET contest_name = '', judge_count = 3, ai_prompt = 'Modern and Professional',
       ai_model = ?, ai_provider = ?,
       computation_type = 'average', custom_base = 'average', tie_break_method = 'midrank',
       contest_type = 'pageant', is_judge_locked = 0, ui_mode = 'ai'
       WHERE school_id = ?`,
      [DEFAULT_MODEL, DEFAULT_PROVIDER, schoolId]
    );
    await connection.commit();
    await invalidateSchoolCaches(schoolId);
    return { success: true, message: 'All data for your school has been cleared.' };
  } catch (err) {
    await connection.rollback();
    throw new HttpError(500, 'Failed to reset database: ' + err.message);
  } finally {
    connection.release();
  }
}

// ── SAVE CONTEST CONFIG (transaction) ──
async function saveConfig(schoolId, body) {
  const {
    contest_name, judge_count, ai_prompt, contestants: incomingContestants,
    criteria, computation_type, contest_type, is_judge_locked,
    custom_base, tie_break_method, ai_model, ai_provider, ui_mode,
  } = body;

  // Validate the complete incoming roster before any settings/scores are changed.
  let contestants;
  if (incomingContestants !== undefined) {
    if (!Array.isArray(incomingContestants)) {
      throw new HttpError(400, 'Contestants must be a list.');
    }
    const names = [];
    const compareNames = new Intl.Collator('en', { sensitivity: 'base' });
    contestants = incomingContestants.map((contestant) => {
      const name = typeof contestant?.name === 'string' ? contestant.name.trim() : '';
      if (!name || [...name].length > 255) {
        throw new HttpError(400, 'Each contestant needs a name between 1 and 255 characters.');
      }
      if (names.some((existing) => compareNames.compare(existing, name) === 0)) {
        throw new HttpError(409, `Contestant "${name}" already exists in this contest. Use a different name.`);
      }
      names.push(name);
      return { ...contestant, name };
    });
  }

  console.log(`💾 [saveConfig] school=${schoolId} provider=${ai_provider} prompt="${ai_prompt?.slice(0,60)}..." model=${ai_model} ui_mode=${ui_mode} contestants=${contestants?.length} criteria=${criteria?.length}`);

  // Diff helpers — skip delete/re-insert (and the score wipe + judge UI
  // refresh that follows) when the incoming row set already matches the DB
  // exactly. Saving the same config repeatedly must be a true no-op.
  const rowsEqual = (dbRows, incoming) => {
    if (incoming.length !== dbRows.length) return false;
    return incoming.every((row, i) => {
      const db = dbRows[i];
      const a = String(row.name || '').trim();
      const b = String(db.name || '').trim();
      if (a !== b) return false;
      const av = row.entry_number !== undefined ? Number(row.entry_number) : 0;
      const bv = db.entry_number !== undefined ? Number(db.entry_number) : db.entry_number;
      return av === Number(bv) || Number.isNaN(bv);
    });
  };
  const criteriaEqual = (dbRows, incoming) => {
    if (incoming.length !== dbRows.length) return false;
    return incoming.every((row, i) => {
      const db = dbRows[i];
      const a = String(row.name || '').trim();
      const b = String(db.name || '').trim();
      if (a !== b) return false;
      const av = row.percentage !== undefined ? Number(row.percentage) : 0;
      const bv = Number(db.percentage) || 0;
      return av === bv;
    });
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Track whether anything the judge table renders on actually changed.
    let promptChanged = false;
    let modelChanged = false;
    let providerChanged = false;
    let modeChanged = false;

    // Use explicit UPDATE instead of INSERT ... ON DUPLICATE KEY UPDATE VALUES()
    // VALUES() is deprecated in MySQL 8+ and causes unpredictable multi-row updates
    const [existing] = await connection.execute(
      'SELECT id, ai_prompt, ai_model, ai_provider, ui_mode FROM settings WHERE school_id = ? LIMIT 1',
      [schoolId]
    );

    // Partial updates (e.g. lock/unlock sends ONLY is_judge_locked) must not
    // wipe the other stored settings, so only include fields the client
    // actually supplied in the UPDATE.
    const scalarFields = {
      contest_name:     () => contest_name ?? '',
      contest_type:     () => contest_type ?? 'pageant',
      judge_count:      () => judge_count ?? 3,
      ai_prompt:        () => ai_prompt ?? '',
      ai_model:         () => ai_model ?? DEFAULT_MODEL,
      ai_provider:      () => ai_provider ?? DEFAULT_PROVIDER,
      ui_mode:          () => ui_mode ?? 'ai',
      computation_type: () => computation_type ?? 'average',
      custom_base:      () => custom_base ?? 'average',
      tie_break_method: () => tie_break_method ?? 'midrank',
      is_judge_locked:  () => is_judge_locked ?? 0,
    };

    // Backend validation — never trust frontend values. When the admin saves an
    // AI provider and/or model, the resulting combination MUST be one of the
    // allowed ones from the centralized config (Groq/Gemini + their
    // configured model ids). Invalid pairs are rejected outright. Legacy
    // pre-Groq 'unorouter'/'codestral-latest' values from old DB rows are
    // coalesced first so those rows validate + save under the new names.
    if (Object.prototype.hasOwnProperty.call(body, 'ai_provider') ||
        Object.prototype.hasOwnProperty.call(body, 'ai_model')) {
      const currentProvider = aiModels.coalesceProvider(ai_provider || existing[0]?.ai_provider) || DEFAULT_PROVIDER;
      const currentModel = aiModels.coalesceModel(ai_model || existing[0]?.ai_model) || DEFAULT_MODEL;
      try {
        aiModels.assertValidProviderModel(currentProvider, currentModel);
      } catch (err) {
        throw new HttpError(400, err.message);
      }
    }

    if (existing.length > 0) {
      // Row exists — UPDATE only this school's row, and only the columns
      // present in the request body so sparse saves can't wipe other settings.
      const updates = Object.keys(scalarFields)
        .filter((field) => Object.prototype.hasOwnProperty.call(body, field));
      const assignments = updates.map((field) => `${field} = ?`).join(', ');

      if (updates.length === 0) {
        throw new HttpError(400, 'No settings fields provided.');
      }

      if (updates.includes('ai_prompt')) {
        promptChanged = (ai_prompt ?? '') !== (existing[0]?.ai_prompt ?? '');
      }
      if (updates.includes('ai_model')) {
        modelChanged = (ai_model ?? DEFAULT_MODEL) !== (aiModels.coalesceModel(existing[0]?.ai_model) || DEFAULT_MODEL);
      }
      if (updates.includes('ai_provider')) {
        providerChanged = (ai_provider ?? DEFAULT_PROVIDER) !== (aiModels.coalesceProvider(existing[0]?.ai_provider) || DEFAULT_PROVIDER);
      }
      if (updates.includes('ui_mode')) {
        modeChanged = (ui_mode ?? 'ai') !== (existing[0]?.ui_mode || 'ai');
      }

      console.log(`📝 [saveConfig] UPDATE fields=${updates.join(',')} promptChanged=${promptChanged} modelChanged=${modelChanged} providerChanged=${providerChanged} modeChanged=${modeChanged}`);

      await connection.execute(
        `UPDATE settings SET ${assignments} WHERE school_id = ?`,
        [...updates.map((field) => scalarFields[field]()), schoolId]
      );
    } else {
      // No row yet — INSERT a fresh one
      if (ai_prompt)   promptChanged = true;
      if (ai_model)    modelChanged = true;
      if (ai_provider) providerChanged = true;
      if (ui_mode)     modeChanged = true;
      console.log(`📝 [saveConfig] INSERT new row promptChanged=${promptChanged} modelChanged=${modelChanged} providerChanged=${providerChanged} modeChanged=${modeChanged}`);
      await connection.execute(
        `INSERT INTO settings
           (school_id, contest_name, contest_type, judge_count, ai_prompt, ai_model, ai_provider, ui_mode,
            computation_type, custom_base, tie_break_method, is_judge_locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          schoolId,
          contest_name     ?? '',
          contest_type     ?? 'pageant',
          judge_count      ?? 3,
          ai_prompt        ?? '',
          ai_model         ?? DEFAULT_MODEL,
          ai_provider      ?? DEFAULT_PROVIDER,
          ui_mode          ?? 'ai',
          computation_type ?? 'average',
          custom_base      ?? 'average',
          tie_break_method ?? 'midrank',
          is_judge_locked  ?? 0,
        ]
      );
    }

    const [readback] = await connection.execute(
      'SELECT ui_mode, ai_prompt FROM settings WHERE school_id = ?',
      [schoolId]
    );
    console.log(`🔎 [saveConfig] post-write readback school=${schoolId} rows=${readback.length} ui_mode=${readback[0]?.ui_mode} ai_prompt="${String(readback[0]?.ai_prompt ?? '').slice(0, 60)}"`);

    const waiting = [];

    if (contestants !== undefined && criteria !== undefined) {
      const [existingContestants] = await connection.execute(
        'SELECT id, name, entry_number FROM contestants WHERE school_id = ? ORDER BY entry_number ASC, id ASC',
        [schoolId]
      );
      const [existingCriteria] = await connection.execute(
        'SELECT id, name, percentage FROM criteria WHERE school_id = ? ORDER BY id ASC',
        [schoolId]
      );
      const contestantsChanged = !rowsEqual(existingContestants, contestants);
      const criteriaChanged    = !criteriaEqual(existingCriteria, criteria);

      // Contestants/criteria are deleted and re-inserted below with NEW ids,
      // so any existing scores (which reference the old ids) must be wiped
      // ONLY when those lists actually change — otherwise the foreign keys
      // fk_scores_contestant / fk_scores_criteria reject fresh submissions
      // with "Cannot add or update a child row".
      //
      // Rendering-only changes (ai_prompt, ai_model, ai_provider, ui_mode,
      // computation_type, lock toggle…) keep the exact same contestant and
      // criterion ids, so the judges' submitted scores remain valid. They
      // must NOT be wiped or the leaderboard instantly shows empty standings
      // ("No scores submitted yet") right after a prompt tweak.
      if (contestantsChanged || criteriaChanged) {
        await connection.execute('DELETE FROM scores WHERE school_id = ?', [schoolId]);
      }

      // NOTE: ui_cache is intentionally NOT cleared here. It acts as an
      // archive/debug log of every generated design (AI and Default-mode
      // saves alike) so old layouts can be inspected later. The judge always
      // fetches the LATEST single row, so stale rows never surface.

      if (contestantsChanged) {
        await connection.execute('DELETE FROM contestants WHERE school_id = ?', [schoolId]);
        for (const c of contestants) {
          waiting.push([
            'INSERT INTO contestants (school_id, name, entry_number) VALUES (?, ?, ?)',
            [schoolId, c.name || 'Unnamed', c.entry_number || 0],
          ]);
        }
      }

      if (criteriaChanged) {
        await connection.execute('DELETE FROM criteria WHERE school_id = ?', [schoolId]);
        for (const cr of criteria) {
          waiting.push([
            'INSERT INTO criteria (school_id, name, percentage) VALUES (?, ?, ?)',
            [schoolId, cr.name || 'New Criteria', cr.percentage || 0],
          ]);
        }
      }
    } else {
      // Single-list saves (e.g. partial payloads) — keep legacy behavior:
      // clear scores and rebuild whichever list was supplied.
      if (contestants !== undefined || criteria !== undefined) {
        await connection.execute('DELETE FROM scores WHERE school_id = ?', [schoolId]);
      }

      if (contestants !== undefined) {
        await connection.execute('DELETE FROM contestants WHERE school_id = ?', [schoolId]);
        for (const c of contestants) {
          waiting.push([
            'INSERT INTO contestants (school_id, name, entry_number) VALUES (?, ?, ?)',
            [schoolId, c.name || 'Unnamed', c.entry_number || 0],
          ]);
        }
      }

      if (criteria !== undefined) {
        await connection.execute('DELETE FROM criteria WHERE school_id = ?', [schoolId]);
        for (const cr of criteria) {
          waiting.push([
            'INSERT INTO criteria (school_id, name, percentage) VALUES (?, ?, ?)',
            [schoolId, cr.name || 'New Criteria', cr.percentage || 0],
          ]);
        }
      }
    }

    for (const [sql, vals] of waiting) {
      try {
        await connection.execute(sql, vals);
      } catch (error) {
        // MySQL is authoritative (including its collation rules and concurrent writes).
        if (error.code === 'ER_DUP_ENTRY' && sql.startsWith('INSERT INTO contestants ')) {
          throw new HttpError(409, 'A contestant with this name already exists in this contest. Use a different name.');
        }
        throw error;
      }
    }

    await connection.commit();
    await invalidateSchoolCaches(schoolId);

    // Every admin save gets one config_history row — a full post-save snapshot.
    // Logged here (outside the transaction) so a history write failure can
    // never roll back an otherwise-valid save; it is only surfaced as a warn.
    try {
      const entry = await addHistory(schoolId);
      console.log(`📜 [saveConfig] history entry #${entry.id} logged school=${schoolId}`);
    } catch (historyErr) {
      console.warn(`⚠️  [saveConfig] failed to log history school=${schoolId}:`, historyErr.message);
    }

    return { success: true, message: 'Configuration saved!' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ── SAVE SYSTEM CONFIG ──
async function saveSystemConfig(schoolId, body) {
  const {
    school_name, portal_name, school_logo, background_logo,
    primary_color, secondary_color, footer_text, logo_radius,
    header_template,
  } = body;

  await pool.execute(
    `INSERT INTO system_config
       (school_id, school_name, portal_name, school_logo, background_logo,
        primary_color, secondary_color, footer_text, logo_radius, header_template)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       school_name     = VALUES(school_name),
       portal_name     = VALUES(portal_name),
       school_logo     = VALUES(school_logo),
       background_logo = VALUES(background_logo),
       primary_color   = VALUES(primary_color),
       secondary_color = VALUES(secondary_color),
       footer_text     = VALUES(footer_text),
       logo_radius     = VALUES(logo_radius),
       header_template = VALUES(header_template)`,
    [
      schoolId,
      school_name     || null,
      portal_name     || null,
      school_logo     || null,
      background_logo || null,
      primary_color   || '#22c55e',
      secondary_color || '#0f172a',
      footer_text     || null,
      logo_radius     != null ? Number(logo_radius) : 12,
      header_template || 'structured',
    ]
  );

  await invalidateSchoolCaches(schoolId, { system: true, ui: false });

  return { success: true, message: 'System configuration updated.' };
}

module.exports = {
  getSystemConfig,
  getAllData,
  getActiveSchools,
  computeLeaderboard,
  getJudgeIds,
  getJudgeScores,
  resetData,
  saveConfig,
  saveSystemConfig,
};
