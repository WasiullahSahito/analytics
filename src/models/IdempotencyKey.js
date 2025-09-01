const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: '24h' }, // TTL index
});

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);