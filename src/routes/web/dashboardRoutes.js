const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dashboardController');
const { isAuthenticated, isStaff } = require('../../middleware/authMiddleware');

//router.get('/dashboard', isAuthenticated, isStaff, dashboardController.renderDashboard);
//router.get('/dashboard', isAuthenticated, dashboardController.renderDashboard);

// src/routes/web/dashboardRoutes.js
router.get('/dashboard', isAuthenticated, dashboardController.renderDashboard);

module.exports = router;