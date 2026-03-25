const { Client, GatewayIntentBits, Events } = require('discord.js');
const db = require('../database/manager');
const config = require('../utils/config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

console.log('🏁 Script started. Attempting to login...');

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Logged in as ${client.user.tag} for historical sync...`);

    const resultChannels = db.getResultChannels();
    const resultCmdChannel = config.RESULT_COMMAND_CHANNEL_ID;
    const channelsToScan = [...new Set([...resultChannels, resultCmdChannel])].filter(Boolean);

    console.log(`🔍 Channels to scan: ${channelsToScan.length}`);

    let totalTiers = 0;
    let totalLogs = 0;

    for (const channelId of channelsToScan) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.log(`⚠️ Could not fetch channel: ${channelId}`);
                continue;
            }

            console.log(`\n📂 Scanning <#${channel.id}> (${channel.name})...`);

            let lastId = null;
            let channelCount = 0;

            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                console.log(`📑 Processing ${messages.size} messages (Total so far: ${channelCount + messages.size})...`);

                for (const [id, msg] of messages) {
                    lastId = id;

                    if (msg.embeds.length > 0) {
                        for (const embed of msg.embeds) {
                            const desc = embed.description;
                            if (!desc) continue;

                            // Robust matching with capturing groups and flexible whitespace/newlines
                            const ignMatch = desc.match(/\*\*IGN:\*\*\s*(?:[\r\n]+)?([^\r\n]+)/i);
                            const userMatch = desc.match(/\*\*USER:\*\*\s*(?:[\r\n]+)?<@!?(\d+)>/i);
                            const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*(?:[\r\n]+)?([^\r\n]+)/i);
                            const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*(?:[\r\n]+)?([^\r\n]+)/i);
                            const regionMatch = desc.match(/\*\*REGION:\*\*\s*(?:[\r\n]+)?([^\r\n]+)/i);
                            const testerMatch = desc.match(/\*\*TESTER:\*\*\s*(?:[\r\n]+)?<@!?(\d+)>/i);

                            if (ignMatch && userMatch && tierMatch && categoryMatch) {
                                const userId = userMatch[1].trim();
                                const ign = ignMatch[1].trim();
                                const tier = tierMatch[1].trim().replace(/[ ;]/g, ''); // Clean up symbols/spaces
                                const category = categoryMatch[1].trim();
                                const region = regionMatch ? regionMatch[1].trim() : 'Global';

                                // Update tier without Gist save yet
                                db.updateUserTier(userId, ign, tier, category, region, false);
                                totalTiers++;

                                // Sync Logs
                                if (testerMatch) {
                                    const testerId = testerMatch[1].trim();
                                    db.logTest(testerId, userId, ign, category, tier, msg.createdTimestamp);
                                    totalLogs++;
                                }
                            }
                        }
                    }
                }
                channelCount += messages.size;
            }
            console.log(`✅ Finished scanning channel. Found ${channelCount} messages.`);

        } catch (e) {
            console.error(`❌ Error scanning channel ${channelId}:`, e);
        }
    }

    console.log(`\n🎉 Sync complete!`);
    console.log(`🎭 Tiers Synced: ${totalTiers}`);
    console.log(`📜 Logs Synced: ${totalLogs}`);

    // Call saveJson once at the end!
    console.log(`📡 Final sync to GitHub Gist...`);
    db.saveJson();

    console.log(`✅ All clear. Closing in 5 seconds...`);
    setTimeout(() => {
        process.exit(0);
    }, 5000);
});

client.login(config.TOKEN).catch(err => {
    console.error('❌ Failed to login:', err);
    process.exit(1);
});
