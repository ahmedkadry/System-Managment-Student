const express = require('express');
const router = express.Router();
const c = require('../../controllers/teacherController');
const { isAdmin } = require('../../middleware/authMiddleware');

router.use(isAdmin);
router.get('/', c.getTeachers);
router.get('/create', c.renderCreateForm);
router.post('/create', c.createTeacher);
router.get('/edit/:id', c.renderEditForm);
router.post('/edit/:id', c.updateTeacher);
router.get('/delete/:id', c.deleteTeacher);

module.exports = router;