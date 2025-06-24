const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const verifyToken = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// All routes require authentication
router.use(verifyToken);

// Reports routes
router.get('/sales', checkRole(['admin', 'agent']), reportsController.getSalesReport);
router.get('/prizes', checkRole(['admin', 'agent']), reportsController.getPrizesReport);

module.exports = router;