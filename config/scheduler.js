const cron = require('node-cron');
const rescuePricingService = require('../services/rescuePricingService');

/**
 * Initialize all scheduled jobs
 */
const initScheduledJobs = () => {
    console.log('📅 Initializing scheduled jobs...');

    // Run rescue pricing check daily at midnight (00:00)
    // Cron format: second minute hour day month weekday
    // '0 0 0 * * *' = At 00:00:00 every day
    cron.schedule('0 0 0 * * *', async () => {
        console.log('⏰ Running scheduled rescue pricing check at midnight...');
        try {
            await rescuePricingService.checkAndNotifyRescuePricing();
        } catch (error) {
            console.error('❌ Error in scheduled rescue pricing check:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });

    // OPTIONAL: For testing - run every 5 minutes (comment out when done testing)
    // Uncomment the lines below to test the rescue pricing feature more frequently
    /*
    cron.schedule('0 *\/5 * * * *', async () => {
        console.log('🧪 [TEST] Running rescue pricing check (every 5 minutes)...');
        try {
            await rescuePricingService.checkAndNotifyRescuePricing();
        } catch (error) {
            console.error('❌ Error in test rescue pricing check:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
    */

    console.log('✅ Scheduled jobs initialized successfully');
    console.log('   - Rescue pricing check: Daily at 00:00 (Asia/Ho_Chi_Minh)');
};

module.exports = { initScheduledJobs };
