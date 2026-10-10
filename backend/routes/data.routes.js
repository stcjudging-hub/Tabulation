const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/data.controller');
const streamCtrl = require('../controllers/ai-stream.controller');
const { requireAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — no auth required
// ─────────────────────────────────────────────────────────────────────────────
router.get('/public/system-config', ctrl.publicSystemConfig);
router.get('/public/get-all-data', ctrl.publicGetAllData);
router.get('/public/leaderboard', ctrl.publicLeaderboard);
router.get('/public/judge/ids', ctrl.publicJudgeIds);
router.get('/public/judge/scores', ctrl.publicJudgeScores);
router.get('/public/active-schools', ctrl.publicActiveSchools);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES — auth required from here down
// ─────────────────────────────────────────────────────────────────────────────
router.use(requireAuth);

router.get('/get-all-data', ctrl.getAllData);
router.get('/ai-models', ctrl.aiModels);
router.get('/leaderboard', ctrl.leaderboard);
router.get('/judge/ids', ctrl.judgeIds);
router.get('/judge/my-scores', ctrl.judgeMyScores);
router.delete('/reset-data', ctrl.resetData);
router.post('/save-config', ctrl.saveConfig);
router.post('/suggest-criteria', ctrl.suggestCriteria);
router.post('/results-summary', ctrl.resultsSummary);
router.post('/stream-ui', streamCtrl.stream);
router.get('/system-config', ctrl.systemConfig);
router.post('/save-system-config', ctrl.saveSystemConfig);

// ── Config history (admin audit of every save) ──
router.get('/history', ctrl.history);
router.get('/history/:id', ctrl.historyDetail);
router.post('/history/delete', ctrl.deleteHistory);
router.delete('/history/all', ctrl.deleteAllHistory);

module.exports = router;