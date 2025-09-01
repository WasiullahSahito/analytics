const cron = require('node-cron');
const Event = require('../models/Event');
const DailyMetric = require('../models/DailyMetric');
const PostDailyMetric = require('../models/PostDailyMetric');

const runDailyRollup = async () => {
    console.log('Running daily rollup job...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    try {
        // --- Calculate Post-specific Metrics ---
        const postMetricsPipeline = [
            { $match: { timestamp: { $gte: yesterday, $lt: today } } },
            {
                $group: {
                    _id: '$postId',
                    views: { $sum: { $cond: [{ $eq: ['$event', 'post_view'] }, 1, 0] } },
                    likes: { $sum: { $cond: [{ $eq: ['$event', 'post_like'] }, 1, 0] } },
                    comments: { $sum: { $cond: [{ $eq: ['$event', 'comment_create'] }, 1, 0] } },
                }
            },
            { $match: { _id: { $ne: null } } }
        ];

        const postMetrics = await Event.aggregate(postMetricsPipeline);

        if (postMetrics.length > 0) {
            const bulkOps = postMetrics.map(metric => ({
                updateOne: {
                    filter: { postId: metric._id, date: yesterday },
                    update: { $set: { views: metric.views, likes: metric.likes, comments: metric.comments } },
                    upsert: true
                }
            }));
            await PostDailyMetric.bulkWrite(bulkOps);
        }

        // --- Calculate Global Metrics ---
        // DAU
        const dau = await Event.distinct('userId', {
            timestamp: { $gte: yesterday, $lt: today },
            userId: { $ne: null }
        });

        // Total Views, Likes, Comments
        const totalViews = postMetrics.reduce((sum, item) => sum + item.views, 0);
        const totalLikes = postMetrics.reduce((sum, item) => sum + item.likes, 0);
        const totalComments = postMetrics.reduce((sum, item) => sum + item.comments, 0);

        await DailyMetric.updateOne(
            { date: yesterday },
            {
                $set: {
                    dau: dau.length,
                    totals: {
                        views: totalViews,
                        likes: totalLikes,
                        comments: totalComments
                    },
                    generatedAt: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`Daily rollup for ${yesterday.toISOString().split('T')[0]} completed successfully.`);
    } catch (error) {
        console.error('Error running daily rollup job:', error);
    }
};

// Schedule to run every day at 1:05 AM server time
const schedule = () => {
    cron.schedule('5 1 * * *', runDailyRollup);
};

module.exports = { schedule, runDailyRollup };