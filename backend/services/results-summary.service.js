// ── AI results summary ───────────────────────────────────────────────────────
// Produces a short, plain-language report from the COMPUTED results:
//   • the winners (including ties at the top),
//   • how close the top scores were,
//   • any ties in the standings,
//   • scores flagged as inconsistent (a judge whose total for a contestant is a
//     statistical outlier vs. the other judges).
//
// All numbers are computed here from the live score tables; the LLM is only
// asked to narrate the FACTS. The facts object is returned alongside the text
// so the frontend can show hard data next to the prose.

const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const dataService = require('./data.service');
const aiService = require('../ai/ai-service');
const { resolveAiConfig } = require('./ai-config.service');
const { numeric } = require('../utils/ranks');

// A judge total is flagged when it deviates >= 2 standard deviations from the
// other judges' totals for the SAME contestant (needs at least 3 judges).
const OUTLIER_Z = 2;
// A judge is flagged for overall bias when their average total deviates this
// many std-devs from the other judges' averages (needs at least 3 judges).
const JUDGE_BIAS_Z = 1.5;

function stddev(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round2(v) {
  return Math.round((numeric(v) + Number.EPSILON) * 100) / 100;
}

// ── Compute the factual basis for the report ─────────────────────────────────
async function gatherFacts(schoolId) {
  const [settingsRows] = await pool.execute(
    `SELECT contest_name, computation_type, custom_base, tie_break_method
       FROM settings WHERE school_id = ? LIMIT 1`,
    [schoolId]
  );
  const settings = settingsRows[0] || {};

  const standings = await dataService.computeLeaderboard(schoolId);
  if (!standings || !standings.length) {
    throw new HttpError(400, 'No results to summarize yet — make sure scores have been submitted.');
  }

  const isRankMode =
    settings.computation_type === 'rank' ||
    (settings.computation_type === 'custom' && settings.custom_base === 'rank');
  const valueOf = (row) => round2(isRankMode ? row.total_rank : row.final_score);

  // Winners = everyone sharing the best rank (rank mode: lowest rank-sum; the
  // standings are already ordered best → worst).
  const bestRank = Math.min(...standings.map((r) => numeric(r.rank)));
  const winners = standings
    .filter((r) => numeric(r.rank) === bestRank)
    .map((r) => ({ name: r.name, entry_number: r.entry_number, value: valueOf(r), rank: r.rank }));

  // Distinct ranked positions, sorted best → worst, to measure the gap between
  // 1st and 2nd (their underlying values, not the midranks).
  const byRank = [...standings].sort((a, b) => numeric(a.rank) - numeric(b.rank));
  const topTwo = [];
  const seenValues = new Set();
  for (const row of byRank) {
    const v = valueOf(row);
    if (!seenValues.has(v)) {
      seenValues.add(v);
      topTwo.push(row);
    }
    if (topTwo.length === 2) break;
  }
  const margin = topTwo.length === 2 ? round2(Math.abs(valueOf(topTwo[0]) - valueOf(topTwo[1]))) : null;

  // Ties: rank values shared by more than one contestant.
  const rankGroups = {};
  standings.forEach((r) => {
    const key = String(r.rank);
    (rankGroups[key] = rankGroups[key] || []).push(r);
  });
  const ties = Object.values(rankGroups)
    .filter((group) => group.length > 1)
    .map((group) => ({ rank: numeric(group[0].rank), names: group.map((r) => r.name) }));

  // ── Judging consistency: per-contestant, per-judge totals ──
  const [raw] = await pool.execute(
    `SELECT s.judge_id, s.contestant_id, c.name,
            SUM(s.score_value) AS total
       FROM scores      s
       JOIN contestants c ON c.id = s.contestant_id AND c.school_id = ?
      WHERE s.school_id = ?
      GROUP BY s.judge_id, s.contestant_id`,
    [schoolId, schoolId]
  );

  const byContestant = {};
  const judgeIds = new Set();
  raw.forEach((row) => {
    judgeIds.add(String(row.judge_id));
    const key = String(row.contestant_id);
    if (!byContestant[key]) byContestant[key] = { name: row.name, scores: {} };
    byContestant[key].scores[String(row.judge_id)] = round2(row.total);
  });

  const judgeCount = judgeIds.size;

  const contestantOutliers = [];
  Object.values(byContestant).forEach(({ name, scores }) => {
    const values = Object.values(scores);
    if (values.length < 3) return;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = stddev(values);
    if (sd <= 0) return;
    Object.entries(scores).forEach(([judgeId, total]) => {
      const z = (total - mean) / sd;
      if (Math.abs(z) >= OUTLIER_Z) {
        contestantOutliers.push({
          contestant: name,
          judgeId,
          score: total,
          peerAverage: round2(mean),
          direction: total > mean ? 'higher' : 'lower',
        });
      }
    });
  });

  // ── Judge-level bias: each judge's average total vs. the panel ──
  const judgeBias = [];
  if (judgeCount >= 3) {
    const perJudge = {};
    raw.forEach((row) => {
      const jid = String(row.judge_id);
      (perJudge[jid] = perJudge[jid] || []).push(numeric(row.total));
    });
    const averages = Object.entries(perJudge).map(([jid, list]) => ({
      judgeId: jid,
      average: round2(list.reduce((a, b) => a + b, 0) / list.length),
    }));
    const overall = averages.reduce((s, a) => s + a.average, 0) / averages.length;
    const sd = stddev(averages.map((a) => a.average));
    if (sd > 0) {
      averages.forEach((a) => {
        const z = (a.average - overall) / sd;
        if (Math.abs(z) >= JUDGE_BIAS_Z) {
          judgeBias.push({
            judgeId: a.judgeId,
            average: a.average,
            panelAverage: round2(overall),
            direction: a.average > overall ? 'higher' : 'lower',
          });
        }
      });
    }
  }

  return {
    contestName: settings.contest_name || 'the contest',
    mode: isRankMode ? 'rank-sum' : 'average',
    judgeCount,
    winners,
    margin,
    standings: byRank.map((r) => ({ rank: r.rank, name: r.name, value: valueOf(r) })),
    ties,
    inconsistent: {
      judgeOutliers: contestantOutliers,
      judgeBias,
    },
  };
}

function buildPrompt(facts) {
  return `
You are writing a short, plain-language results report for a school contest. Use ONLY the facts in the JSON below — never invent names, numbers, or events.

[FACTS]
${JSON.stringify(facts, null, 2)}

[INSTRUCTIONS]
- Write ONE short paragraph of 3 to 6 sentences in clear, friendly, professional language.
- State the winner(s) by name. If it is a tie, say so plainly.
- Mention how close the top scores were (use the margin when available).
- Mention any ties in the standings.
- If "inconsistent.judgeOutliers" or "inconsistent.judgeBias" are non-empty, briefly note which judge(s)/scores looked inconsistent, in neutral, factual terms. If both are empty, state that no inconsistent scoring was detected.
- Do NOT use markdown, bullet points, headings, or emojis. Output plain prose only.
  `.trim();
}

async function summarize(schoolId) {
  const facts = await gatherFacts(schoolId);
  const { provider, model } = await resolveAiConfig(schoolId);

  let summary;
  try {
    summary = await aiService.generate({ provider, model, prompt: buildPrompt(facts) });
  } catch (err) {
    const status = err && err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    throw new HttpError(status, err?.message || 'The AI could not write the summary right now. Please try again.');
  }

  console.log(`🧾 [results-summary] school=${schoolId} provider=${provider} model=${model} winners=${facts.winners.length} outliers=${facts.inconsistent.judgeOutliers.length}`);
  return { summary: String(summary || '').trim(), facts };
}

module.exports = { summarize, gatherFacts };
