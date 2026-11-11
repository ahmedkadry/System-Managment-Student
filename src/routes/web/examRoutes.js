const express = require('express');
const router = express.Router();
const c = require('../../controllers/examController');
const { isStaff, isAdmin } = require('../../middleware/authMiddleware');

// View exams & enter grades: Staff (Admin + Teacher)
router.get('/', isStaff, c.listExams);
router.get('/:id/grades', isStaff, c.renderGradeEntry);
router.post('/:id/grades', isStaff, c.saveGrades);

// Create/edit/delete exams: Admin only
router.get('/create', isAdmin, c.renderCreateForm);
router.post('/create', isAdmin, c.createExam);
router.get('/edit/:id', isAdmin, c.renderEditForm);
router.post('/edit/:id', isAdmin, c.updateExam);
router.get('/delete/:id', isAdmin, c.deleteExam);

// Report card: staff can view any; students can view their own (add middleware later)
router.get('/report-card/:id', isStaff, c.studentReportCard);

module.exports = router;