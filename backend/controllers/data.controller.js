const HttpError = require('../utils/http-error');
const dataService = require('../services/data.service');
const historyService = require('../services/history.service');
const criteriaAiService = require('../services/criteria-ai.service');
const resultsSummaryService = require('../services/results-summary.service');
const aiModels = require('../ai/ai-models');

// ── SAFE AI MODEL METADATA (no credentials — names + ids only) ──
exports.aiModels = async (req, res) => {
  res.json({ success: true, providers: aiModels.safeModelMetadata() });
};

// ── PUBLIC ROUTES ──
exports.publicSystemConfig = async (req, res) => {
  const school_id = req.query.school_id;
  if (!school_id) throw new HttpError(400, 'school_id query param required.');
  res.json(await dataService.getSystemConfig(school_id));
};

exports.publicGetAllData = async (req, res) => {
  const school_id = req.query.school_id;
  if (!school_id) throw new HttpError(400, 'school_id query param required.');
  res.json(await dataService.getAllData(school_id));
};

exports.publicLeaderboard = async (req, res) => {
  const school_id = req.query.school_id;
  if (!school_id) throw new HttpError(400, 'school_id query param required.');
  const result = await dataService.computeLeaderboard(school_id);
  res.json(result ?? []);
};

exports.publicJudgeIds = async (req, res) => {
  const school_id = req.query.school_id;
  if (!school_id) throw new HttpError(400, 'school_id query param required.');
  res.json(await dataService.getJudgeIds(school_id));
};

exports.publicJudgeScores = async (req, res) => {
  const school_id = req.query.school_id;
  const judgeId   = req.query.judgeId;
  if (!school_id) throw new HttpError(400, 'school_id query param required.');
  if (!judgeId)   throw new HttpError(400, 'judgeId query param required.');
  res.json(await dataService.getJudgeScores(school_id, judgeId));
};

exports.publicActiveSchools = async (req, res) => {
  res.json(await dataService.getActiveSchools());
};

// ── PROTECTED ROUTES (auth via middleware) ──
exports.getAllData = async (req, res) => {
  res.json(await dataService.getAllData(req.school_id));
};

exports.leaderboard = async (req, res) => {
  const result = await dataService.computeLeaderboard(req.school_id);
  if (result === null) throw new HttpError(404, 'No settings found for this school.');
  res.json(result);
};

exports.judgeIds = async (req, res) => {
  res.json(await dataService.getJudgeIds(req.school_id));
};

exports.judgeMyScores = async (req, res) => {
  const judgeId = req.query.judgeId;
  if (!judgeId) throw new HttpError(400, 'judgeId query param required.');
  res.json(await dataService.getJudgeScores(req.school_id, judgeId));
};

exports.resetData = async (req, res) => {
  res.json(await dataService.resetData(req.school_id));
};

exports.saveConfig = async (req, res) => {
  res.json(await dataService.saveConfig(req.school_id, req.body));
};

// ── AI-SUGGESTED CRITERIA (protected; uses the school's AI provider/model) ──
exports.suggestCriteria = async (req, res) => {
  const { description } = req.body || {};
  res.json(await criteriaAiService.suggestCriteria(req.school_id, description));
};

// ── AI RESULTS SUMMARY (protected; narrates the computed standings) ──
exports.resultsSummary = async (req, res) => {
  res.json(await resultsSummaryService.summarize(req.school_id));
};

exports.systemConfig = async (req, res) => {
  res.json(await dataService.getSystemConfig(req.school_id));
};

exports.saveSystemConfig = async (req, res) => {
  res.json(await dataService.saveSystemConfig(req.school_id, req.body));
};

// ── CONFIG HISTORY (protected) ──
exports.history = async (req, res) => {
  res.json(await historyService.getHistory(req.school_id));
};

exports.historyDetail = async (req, res) => {
  const entry = await historyService.getHistoryById(req.school_id, req.params.id);
  if (!entry) throw new HttpError(404, 'History entry not found.');
  res.json(entry);
};

exports.deleteHistory = async (req, res) => {
  res.json(await historyService.deleteHistory(req.school_id, req.body?.ids));
};

exports.deleteAllHistory = async (req, res) => {
  res.json(await historyService.deleteAllHistory(req.school_id));
};