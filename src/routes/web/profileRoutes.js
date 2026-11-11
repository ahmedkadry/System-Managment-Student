const express = require('express');
const router = express.Router();
const c = require('../../controllers/profileController');
const { isAuthenticated } = require('../../middleware/authMiddleware');

router.use(isAuthenticated);
router.get('/', c.renderProfile);
router.post('/password', c.changePassword);

module.exports = router;