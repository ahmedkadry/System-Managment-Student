const express = require('express');
const router = express.Router();
const c = require('../../controllers/courseController');
const { isAdmin } = require('../../middleware/authMiddleware');

router.use(isAdmin);
router.get('/', c.getCourses);
router.get('/create', c.renderCreateForm);
router.post('/create', c.createCourse);
router.get('/edit/:id', c.renderEditForm);
router.post('/edit/:id', c.updateCourse);
router.get('/delete/:id', c.deleteCourse);
router.get('/:id', c.showCourse);
router.post('/:id/enroll', c.enrollStudent);
router.post('/:id/unenroll/:enrollmentId', c.unenrollStudent);

module.exports = router;