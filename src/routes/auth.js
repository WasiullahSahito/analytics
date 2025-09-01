const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
    '/register',
    [
        body('username').notEmpty().withMessage('Username is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role')
    ],
    validate,
    registerUser
);

router.post(
    '/login',
    [
        body('username').notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    validate,
    loginUser
);

module.exports = router;