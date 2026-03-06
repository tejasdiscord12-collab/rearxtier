const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../database/manager');
const config = require('../utils/config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    console.log(`Loggged in as ${client.user.tag} for syncing...`);

    const resultChannels = db.getResultChannels();
    const configChannel = config.RESULT_COMMAND_CHANNEL_ID;
    const channelsToScan = [...new Set([...resultChannels, configChannel])];

    let totalCount = 0;

    for (const channelId of channelsToScan) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        console.log(`🔍 Fetching messages from <#${channel.id}>...`);
        let messages = await channel.messages.fetch({ limit: 100 });

        for (const [id, msg] of messages) {
            if (msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                const desc = embed.description;
                if (!desc) continue;

                // Robust regex with better newline handling
                const ignMatch = desc.match(/\*\*IGN:\*\*\s*[\r\n]+([^\r\n]+)/i);
                const userMatch = desc.match(/\*\*USER:\*\*\s*[\r\n]+<@!?(\d+)>/i);
                const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\s*[\r\n]+([^\r\n]+)/i);
                const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\s*[\r\n]+([^\r\n]+)/i);
                const regionMatch = desc.match(/\*\*REGION:\*\*\s*[\r\n]+([^\r\n]+)/i);

                if (ignMatch && userMatch && tierMatch && categoryMatch) {
                    const userId = userMatch[1].trim();
                    const ign = ignMatch[1].trim();
                    const tier = tierMatch[1].trim().replace(';', ''); // Clean up symbols like ;LT
                    const category = categoryMatch[1].trim();
                    const region = regionMatch ? regionMatch[1].trim() : 'Global';

                    db.updateUserTier(userId, ign, tier, category, region);
                    console.log(`✅ Synced: ${ign} (${tier} in ${category} - ${region})`);
                    totalCount++;
                }
            }
        }
    }

    console.log(`\n🎉 Sync complete! Added/Updated ${totalCount} tier entries.`);
    process.exit(0);
});

client.login(config.TOKEN);
