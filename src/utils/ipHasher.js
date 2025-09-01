const crypto = require('crypto');

const hashIp = (ip) => {
    if (!ip) return null;
    return crypto.createHmac('sha256', process.env.IP_HASH_SALT)
        .update(ip)
        .digest('hex');
};

module.exports = hashIp;