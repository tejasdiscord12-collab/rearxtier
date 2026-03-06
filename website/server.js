const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const manager = require('../database/manager');
const config = require('../utils/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/tiers', (req, res) => {
    try {
        const tiers = manager.getAllTiers();
        res.json(tiers);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/queue', (req, res) => {
    try {
        const queue = manager.getQueue();
        const isOpen = manager.isQueueOpen();
        res.json({ queue, isOpen });
    } catch (error) {
        console.error('Queue API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- DISCORD LIVE LISTENER FOR WEBSITE ---
// Log in a secondary connection just for the website to read result messages live!

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, async () => {
    console.log(`📡 Website Discord Listener loaded as ${client.user.tag}`);

    // --- Catch-up Sync: Read last 100 messages to find existing players ---
    const resultChannelId = config.RESULT_COMMAND_CHANNEL_ID;
    console.log(`🔍 Scanning last 100 messages in channel ${resultChannelId} for existing tiers...`);

    const channel = await client.channels.fetch(resultChannelId).catch(() => null);
    if (channel) {
        let totalCount = 0;
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            for (const [id, msg] of messages) {
                if (msg.embeds.length > 0) {
                    for (const embed of msg.embeds) {
                        const desc = embed.description;
                        if (!desc) continue;

                        const ignMatch = desc.match(/\*\*IGN:\*\*\s*[\r\n]+([^\r\n]+)/i);
                        const userMatch = desc.match(/\*\*USER:\*\*\s*[\r\n]+<@!?(\d+)>/i);
                        const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*[\r\n]+([^\r\n]+)/i);
                        const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*[\r\n]+([^\r\n]+)/i);
                        const regionMatch = desc.match(/\*\*REGION:\*\*\s*[\r\n]+([^\r\n]+)/i);

                        if (ignMatch && userMatch && tierMatch && categoryMatch) {
                            const userId = userMatch[1].trim();
                            const ign = ignMatch[1].trim();
                            const tier = tierMatch[1].trim().replace(';', '');
                            const category = categoryMatch[1].trim();
                            const region = regionMatch ? regionMatch[1].trim() : 'Global';

                            manager.updateUserTier(userId, ign, tier, category, region);
                            totalCount++;
                        }
                    }
                }
            }
            console.log(`✅ Successfully synced ${totalCount} historical tiers from Discord.`);
        } catch (err) {
            console.error('❌ Error during catch-up sync:', err);
        }
    } else {
        console.error('❌ Could not find result channel for catch-up sync. Check RESULT_COMMAND_CHANNEL_ID.');
    }

    console.log(`✅ Live-Sync active for results channel: ${resultChannelId}`);
});

client.on(Events.MessageCreate, async message => {
    const resultChannels = manager.getResultChannels();
    const resultCmdChannel = config.RESULT_COMMAND_CHANNEL_ID;

    if (!resultChannels.includes(message.channelId) && message.channelId !== resultCmdChannel) return;
    if (message.embeds.length === 0) return;

    for (const embed of message.embeds) {
        const desc = embed.description;
        if (!desc) continue;

        try {
            const ignMatch = desc.match(/\*\*IGN:\*\*\s*[\r\n]+([^\r\n]+)/i);
            const userMatch = desc.match(/\*\*USER:\*\*\s*[\r\n]+<@!?(\d+)>/i);
            const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*[\r\n]+([^\r\n]+)/i);
            const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*[\r\n]+([^\r\n]+)/i);
            const regionMatch = desc.match(/\*\*REGION:\*\*\s*[\r\n]+([^\r\n]+)/i);

            if (ignMatch && userMatch && tierMatch && categoryMatch) {
                const userId = userMatch[1].trim();
                const ign = ignMatch[1].trim();
                const tier = tierMatch[1].trim().replace(';', '');
                const category = categoryMatch[1].trim();
                const region = regionMatch ? regionMatch[1].trim() : 'Global';

                manager.updateUserTier(userId, ign, tier, category, region);
                console.log(`📡 Website Live-Synced: ${ign} (${tier} in ${category})`);
            }
        } catch (e) { }
    }
});

client.login(config.TOKEN).catch(console.error);

app.listen(PORT, () => {
    console.log(`🚀 Website running at http://localhost:${PORT}`);
});
