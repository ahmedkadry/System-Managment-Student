const express = require('express');
const router = express.Router();
const c = require('../../controllers/reportController');
const { isStaff } = require('../../middleware/authMiddleware');

router.use(isStaff);

router.get('/', c.hub);
router.get('/students', c.studentDirectory);
router.get('/attendance', c.attendanceSummary);
router.get('/grades', c.gradeReport);
router.get('/export/:type', c.exportCSV);

module.exports = router;