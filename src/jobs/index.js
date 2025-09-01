const dailyRollup = require('./dailyRollup');

const initializeJobs = () => {
    dailyRollup.schedule();
    console.log('Cron jobs scheduled.');
};

module.exports = initializeJobs;