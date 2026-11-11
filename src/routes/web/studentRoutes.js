const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/studentController');
const { isAuthenticated, authorizeRoles } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/upload');
const { isAdmin } = require('../../middleware/authMiddleware');


// Only Super Admin + Administrator can manage students
router.use(isAdmin);

// Protect all student routes (Admins and Super Admins only)
//router.use(isAuthenticated, authorizeRoles('Super Admin', 'Administrator'));


router.get('/', studentController.getStudents);
router.get('/create', studentController.renderCreateForm);
router.post('/create', upload.single('profile_photo'), studentController.createStudent);
router.get('/edit/:id', studentController.renderEditForm);
router.post('/edit/:id', upload.single('profile_photo'), studentController.updateStudent);
router.get('/delete/:id', studentController.deleteStudent);

module.exports = router;