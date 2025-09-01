const mongoose = require('mongoose');
const Event = require('../models/Event');
const IdempotencyKey = require('../models/IdempotencyKey');
const DailyMetric = require('../models/DailyMetric');
const PostDailyMetric = require('../models/PostDailyMetric');
const User = require('../models/User');
const hashIp = require('../utils/ipHasher');
const { v4: uuidv4 } = require('uuid');

// --- INGESTION ---
exports.ingestEvents = async (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
        return res.status(400).json({ message: 'X-Idempotency-Key header is required.' });
    }

    const keyExists = await IdempotencyKey.findOne({ key: idempotencyKey });
    if (keyExists) {
        return res.status(422).json({ message: 'Duplicate request based on idempotency key.' });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    if (events.length === 0) {
        return res.status(400).json({ message: 'Event body cannot be empty.' });
    }

    const ipHash = hashIp(req.ip);
    const serverTimestamp = new Date();

    const processedEvents = events.map(e => ({
        ...e,
        timestamp: serverTimestamp,
        metadata: {
            ...e.metadata,
            ipHash,
        },
    }));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await Event.insertMany(processedEvents, { session });
        await new IdempotencyKey({ key: idempotencyKey }).save({ session });
        await session.commitTransaction();

        res.status(202).json({ storedCount: processedEvents.length });
    } catch (error) {
        await session.abortTransaction();
        console.error('Ingestion error:', error);
        res.status(500).json({ message: 'Failed to store events.' });
    } finally {
        session.endSession();
    }
};


// --- READ ENDPOINTS (Admin Only) ---

exports.getOverview = async (req, res) => {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to) : new Date();

    try {
        // 1. DAU and Totals Trend
        const dailyMetrics = await DailyMetric.find({
            date: { $gte: fromDate, $lte: toDate }
        }).sort({ date: 'asc' });

        // 2. Top posts in period
        const topPostsByViews = await PostDailyMetric.aggregate([
            { $match: { date: { $gte: fromDate, $lte: toDate } } },
            { $group: { _id: '$postId', totalViews: { $sum: '$views' } } },
            { $sort: { totalViews: -1 } },
            { $limit: 5 },
            { $project: { postId: '$_id', views: '$totalViews', _id: 0 } }
        ]);

        res.json({
            dauTrend: dailyMetrics.map(m => ({ date: m.date.toISOString().split('T')[0], active: m.dau })),
            totals: dailyMetrics.reduce((acc, curr) => {
                acc.views += curr.totals.views;
                acc.likes += curr.totals.likes;
                acc.comments += curr.totals.comments;
                return acc;
            }, { views: 0, likes: 0, comments: 0 }),
            topPosts: topPostsByViews,
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getActiveUsers = async (req, res) => {
    const window = parseInt(req.query.window || '7', 10);
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - window);

    try {
        const series = await DailyMetric.find({
            date: { $gte: fromDate, $lte: toDate }
        }).sort({ date: 'asc' }).select('date dau -_id');

        res.json({
            granularity: "daily",
            window,
            series: series.map(s => ({ date: s.date.toISOString().split('T')[0], active: s.dau })),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getRetention = async (req, res) => {
    const { cohortStart, windows = '1,7,30' } = req.query;
    if (!cohortStart) {
        return res.status(400).json({ message: 'cohortStart (YYYY-MM-DD) is required.' });
    }

    const retentionWindows = windows.split(',').map(Number);
    const cohortDate = new Date(cohortStart);
    const cohortEndDate = new Date(cohortDate);
    cohortEndDate.setDate(cohortDate.getDate() + 1);

    try {
        // 1. Find users in the cohort
        const cohortUsers = await Event.find({
            event: 'user_register',
            timestamp: { $gte: cohortDate, $lt: cohortEndDate }
        }).distinct('userId');

        if (cohortUsers.length === 0) {
            return res.json({ cohortDate, cohortSize: 0, retention: {} });
        }
        const cohortSize = cohortUsers.length;

        // 2. For each window, find how many of those users were active
        const retentionData = {};
        for (const day of retentionWindows) {
            const windowStartDate = new Date(cohortDate);
            windowStartDate.setDate(cohortDate.getDate() + day);
            const windowEndDate = new Date(windowStartDate);
            windowEndDate.setDate(windowStartDate.getDate() + 1);

            const retainedCount = await Event.countDocuments({
                userId: { $in: cohortUsers },
                event: { $in: ['user_login', 'post_view', 'post_create'] }, // Define "active"
                timestamp: { $gte: windowStartDate, $lt: windowEndDate }
            });

            retentionData[`d${day}`] = (retainedCount / cohortSize) * 100;
        }

        res.json({
            cohortDate: cohortStart,
            cohortSize,
            retention: retentionData
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getTopPosts = async (req, res) => {
    const { metric = 'views', period = '7', limit = '10' } = req.query;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - parseInt(period));

    const validMetrics = ['views', 'likes', 'comments'];
    if (!validMetrics.includes(metric)) {
        return res.status(400).json({ message: 'Invalid metric. Use views, likes, or comments.' })
    }

    try {
        const topPosts = await PostDailyMetric.aggregate([
            { $match: { date: { $gte: fromDate, $lte: toDate } } },
            { $group: { _id: '$postId', totalMetric: { $sum: `$${metric}` } } },
            { $sort: { totalMetric: -1 } },
            { $limit: parseInt(limit) },
            { $project: { postId: '$_id', [metric]: '$totalMetric', _id: 0 } }
        ]);

        res.json({ metric, period: parseInt(period), items: topPosts });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


exports.getPostDetails = async (req, res) => {
    const { postId } = req.params;

    try {
        const metrics = await PostDailyMetric.find({ postId }).sort({ date: 'asc' });

        if (metrics.length === 0) {
            return res.status(404).json({ message: 'No analytics data found for this post.' });
        }

        const totals = metrics.reduce((acc, curr) => {
            acc.views += curr.views;
            acc.likes += curr.likes;
            acc.comments += curr.comments;
            return acc;
        }, { views: 0, likes: 0, comments: 0 });

        const engagementRate = {
            likes: totals.views > 0 ? (totals.likes / totals.views) * 100 : 0,
            comments: totals.views > 0 ? (totals.comments / totals.views) * 100 : 0,
        };

        res.json({
            postId,
            dailySeries: metrics.map(m => ({
                date: m.date.toISOString().split('T')[0],
                views: m.views,
                likes: m.likes,
                comments: m.comments,
            })),
            totals,
            engagementRate
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getTrendingSearches = async (req, res) => {
    const { period = '7', limit = '10' } = req.query;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - parseInt(period));

    try {
        const trending = await Event.aggregate([
            {
                $match: {
                    event: 'search_performed',
                    timestamp: { $gte: fromDate, $lte: toDate },
                    'metadata.query': { $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: { $toLower: '$metadata.query' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) },
            { $project: { term: '$_id', count: 1, _id: 0 } }
        ]);

        res.json({ period: parseInt(period), items: trending });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};