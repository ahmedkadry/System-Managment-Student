const express = require('express');
const router = express.Router();
const c = require('../../controllers/attendanceController');
const { isStaff } = require('../../middleware/authMiddleware');

// Staff (Admin + Teacher) can manage attendance
router.use(isStaff);

router.get('/', c.index);
router.get('/mark', c.renderMarkPage);
router.post('/save', c.saveAttendance);
router.get('/reports', c.reports);

module.exports = router;