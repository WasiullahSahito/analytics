const express = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { ingestEvents, getOverview, getActiveUsers, getRetention, getTopPosts, getPostDetails, getTrendingSearches } = require('../controllers/analyticsController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');

const router = express.Router();

// Rate limiter for the ingest endpoint
const ingestLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after a minute'
});

// --- INGEST ENDPOINT (Public, but rate-limited) ---
router.post('/events', ingestLimiter, ingestEvents);


// --- READ ENDPOINTS (Admin Only) ---
const adminOnly = [auth, admin];

router.get('/overview', adminOnly, [
    query('from').optional().isISO8601().toDate(),
    query('to').optional().isISO8601().toDate()
], validate, getOverview);

router.get('/users/active', adminOnly, [
    query('window').optional().isIn(['7', '30'])
], validate, getActiveUsers);

router.get('/retention', adminOnly, [
    query('cohortStart').isISO8601().toDate(),
    query('windows').optional().isString()
], validate, getRetention);

router.get('/posts/top', adminOnly, [
    query('metric').optional().isIn(['views', 'likes', 'comments']),
    query('period').optional().isIn(['7', '30']),
    query('limit').optional().isInt({ min: 1, max: 50 })
], validate, getTopPosts);

router.get('/posts/:postId', adminOnly, getPostDetails);

router.get('/search/trending', adminOnly, [
    query('period').optional().isIn(['7', '30']),
    query('limit').optional().isInt({ min: 1, max: 50 })
], validate, getTrendingSearches);


module.exports = router;