const mongoose = require('mongoose');

const DailyMetricSchema = new mongoose.Schema({
    date: { type: Date, required: true, unique: true, index: true },
    dau: { type: Number, default: 0 },
    totals: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
    },
    generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DailyMetric', DailyMetricSchema);