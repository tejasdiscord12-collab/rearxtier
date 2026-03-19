const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const manager = require('../database/manager');
const config = require('../utils/config');

const app = express();
const PORT = 26113;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const FS = require('fs');
const PLAYERS_FILE = path.join(__dirname, 'public/players.json');

// API Routes
app.get('/api/tiers', (req, res) => {
    try {
        let tiers = manager.getAllTiers();

        // If database is empty, try loading from players.json file!
        if (tiers.length === 0 && FS.existsSync(PLAYERS_FILE)) {
            const fileData = FS.readFileSync(PLAYERS_FILE, 'utf8');
            tiers = JSON.parse(fileData);
            console.log("📂 Loaded player data from players.json fallback.");
        }

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

// Admin Auth
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === config.ADMIN_PASSWORD) {
        res.json({ success: true, token: 'admin-session-token' }); // Simple token for demo
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Admin Remove Tier
app.post('/api/admin/remove-tier', (req, res) => {
    const { userId, category, token } = req.body;
    if (token !== 'admin-session-token') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const success = manager.removeUserTier(userId, category);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Tier not found' });
        }
    } catch (error) {
        console.error('Admin Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Add Tier
app.post('/api/admin/add-tier', (req, res) => {
    const { userId, ign, tier, category, region, token } = req.body;
    if (token !== 'admin-session-token') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!userId || !ign || !tier || !category) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        manager.updateUserTier(userId, ign, tier, category, region || 'Global');
        res.json({ success: true });
    } catch (error) {
        console.error('Admin Add Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- DISCORD LIVE LISTENER FOR WEBSITE ---
// Log in a secondary connection just for the website to read result messages live!

/*
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, async () => {
    console.log(`📡 Website Discord Listener loaded as ${client.user.tag}`);

    // --- Catch-up Sync: Read last 100 messages to find existing players ---
    const resultChannelIds = [...new Set([config.RESULT_COMMAND_CHANNEL_ID, ...manager.getResultChannels()])];
    console.log(`🔍 Scanning historical messages in channels ${resultChannelIds.join(', ')} for existing tiers and tests...`);

    let totalTiers = 0;
    let totalTests = 0;

    for (const channelId of resultChannelIds) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        try {
            let lastId = null;
            for (let i = 0; i < 5; i++) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                for (const [id, msg] of messages) {
                    lastId = id;
                    if (msg.embeds.length > 0) {
                        for (const embed of msg.embeds) {
                            const desc = embed.description;
                            if (!desc) continue;

                            const ignMatch = desc.match(/\*\*IGN:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
                            const userMatch = desc.match(/\*\*USER:\*\*\s*(?:[\r\n]+)?<@!?(\d+)>/i);
                            const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
                            const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
                            const regionMatch = desc.match(/\*\*REGION:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
                            const testerMatch = desc.match(/\*\*TESTER:\*\*\s*(?:[\r\n]+)?<@!?(\d+)>/i);

                            if (ignMatch && userMatch && tierMatch && categoryMatch) {
                                const userId = userMatch[1].trim();
                                const ign = ignMatch[1].trim();
                                const tier = tierMatch[1].trim().replace(';', '');
                                const category = categoryMatch[1].trim();
                                const region = regionMatch ? regionMatch[1].trim() : 'Global';

                                manager.updateUserTier(userId, ign, tier, category, region);
                                totalTiers++;

                                if (testerMatch) {
                                    const testerId = testerMatch[1].trim();
                                    manager.logTest(testerId, userId, ign, category, tier, msg.createdTimestamp);
                                    totalTests++;
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`❌ Error during catch-up sync for channel ${channelId}:`, err);
        }
    }
    console.log(`✅ Successfully synced ${totalTiers} tiers and ${totalTests} test logs from Discord.`);
    console.log(`✅ Live-Sync active for results channels.`);
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
            const ignMatch = desc.match(/\*\*IGN:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
            const userMatch = desc.match(/\*\*USER:\*\*\s*(?:[\r\n]+)?<@!?(\d+)>/i);
            const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
            const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);
            const regionMatch = desc.match(/\*\*REGION:\*\*\s*(?:[\r\n]+)?([^\r\n\*]+)/i);

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
*/

app.listen(PORT, () => {
    console.log(`🚀 Website running at http://localhost:${PORT}`);
});
