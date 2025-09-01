const mongoose = require('mongoose');

const PostDailyMetricSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    postId: { type: String, required: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
});

PostDailyMetricSchema.index({ postId: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('PostDailyMetric', PostDailyMetricSchema);