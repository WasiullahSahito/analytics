const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    event: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    postId: { type: String, index: true }, // Using String for flexibility
    sessionId: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    metadata: {
        device: String,
        ipHash: String,
        referrer: String,
        path: String,
        query: String, // Specifically for search_performed
    },
});

// Compound index for efficient time-based queries
EventSchema.index({ event: 1, timestamp: -1 });
EventSchema.index({ postId: 1, timestamp: -1 });

module.exports = mongoose.model('Event', EventSchema);