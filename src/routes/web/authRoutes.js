const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../../controllers/authController');
const { guestOnly } = require('../../middleware/authMiddleware');

// Login
router.get('/login', guestOnly, authController.renderLogin);
router.post('/login', authController.login);

// Register
router.get('/register', guestOnly, authController.renderRegister);
router.post('/register', [
    body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 50 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required.').isLength({ max: 50 }),
    body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('role').isIn(['Student', 'Teacher']).withMessage('Invalid role selected.')
], authController.register);

// Logout
router.get('/logout', authController.logout);

module.exports = router;