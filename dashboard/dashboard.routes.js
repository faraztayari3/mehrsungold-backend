const express = require('express');
const { DashboardController } = require('./dashboard.controller');

const router = express.Router();
const dashboardController = new DashboardController();

// GET /dashboard/weekly-metals
router.get('/weekly-metals', (req, res) => dashboardController.getWeeklyMetals(req, res));

module.exports = router;
