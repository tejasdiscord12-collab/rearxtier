const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../database/manager');
const config = require('../utils/config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    const channelId = '1477952781317967943';
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 5 });
        messages.forEach(msg => {
            if (msg.embeds.length > 0) {
                console.log('--- EMBED START ---');
                console.log(msg.embeds[0].description);
                console.log('--- EMBED END ---');
            }
        });
    }
    process.exit(0);
});

client.login(config.TOKEN);
