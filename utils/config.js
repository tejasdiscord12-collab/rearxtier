const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    STAFF_ROLE_ID: process.env.STAFF_ROLE_ID,
    TESTER_ROLE_ID: process.env.TESTER_ROLE_ID,
    TEST_REQUESTS_CHANNEL_ID: process.env.TEST_REQUESTS_CHANNEL_ID,
    ALLY_REQUESTS_CHANNEL_ID: process.env.ALLY_REQUESTS_CHANNEL_ID,
    QUEUE_CHANNEL_ID: process.env.QUEUE_CHANNEL_ID,
    SWORD_QUEUE_CHANNEL_ID: process.env.SWORD_QUEUE_CHANNEL_ID,
    NETHPOT_QUEUE_CHANNEL_ID: process.env.NETHPOT_QUEUE_CHANNEL_ID,
    LOGS_CHANNEL_ID: process.env.LOGS_CHANNEL_ID,
    RESULT_COMMAND_CHANNEL_ID: process.env.RESULT_COMMAND_CHANNEL_ID || '1477991158054518865',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN
};

if (!config.TOKEN) {
    console.error('❌ CRITICAL ERROR: DISCORD_TOKEN is not defined!');
    console.error('Current Working Directory:', process.cwd());
    console.error('Expected .env Path:', path.join(__dirname, '../.env'));
}

module.exports = config;
