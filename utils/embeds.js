const { EmbedBuilder } = require('discord.js');

const COLORS = {
    OPEN: 0x2ecc71,
    CLOSED: 0xe74c3c,
    INFO: 0x3498db,
    GOLD: 0xf1c40f,
    LOG: 0x95a5a6
};

const FOOTER = { text: 'RearMC • Tierlists' };

module.exports = {
    COLORS,
    createBaseEmbed: (title, description, color = COLORS.INFO) => {
        return new EmbedBuilder()
            .setTitle(title.toUpperCase())
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setFooter(FOOTER);
    },
    queueOpenEmbed: (count) => {
        return new EmbedBuilder()
            .setTitle('🟢 TESTING QUEUE OPEN')
            .setColor(COLORS.OPEN)
            .setDescription(
                `The waitlist for tier testing is now **OPEN**!\n\n` +
                `📊 **Status:** Active\n` +
                `⏳ **Waiting:** \`${count}\` players\n\n` +
                `*Click the button below to secure your spot in the queue.*`
            )
            .setThumbnail('https://i.imgur.com/8Dq0lYm.png') // Open Icon
            .setFooter(FOOTER)
            .setTimestamp();
    },
    queueClosedEmbed: () => {
        return new EmbedBuilder()
            .setTitle('🔴 TESTING QUEUE CLOSED')
            .setColor(COLORS.CLOSED)
            .setDescription(
                `The testing queue is currently **CLOSED**.\n\n` +
                `Please wait for a staff member or tester to open it. Keep an eye on the announcements for the next session!\n\n` +
                `*Status: Offline*`
            )
            .setThumbnail('https://i.imgur.com/2YyC6Xq.png') // Closed Icon
            .setFooter(FOOTER)
            .setTimestamp();
    },
    testResultEmbed: (user, ign, oldTier, newTier, category, region, tester) => {
        const kitLower = category.toLowerCase();
        let logo = `attachment://${kitLower}.png`;

        // Fallback checks for logo names used in getKitFiles
        const validKits = ['nethpot', 'sword', 'axe', 'diapot', 'uhc', 'smpkit', 'crystal', 'mace'];
        if (!validKits.includes(kitLower)) {
            if (['nethpot', 'diapot', 'uhc'].includes(kitLower)) logo = 'attachment://pots.png';
            else if (['sword', 'axe', 'smpkit'].includes(kitLower)) logo = 'attachment://sword_axe.png';
            else if (['crystal', 'mace'].includes(kitLower)) logo = 'attachment://crystal_mace.png';
            else logo = null;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${ign.toUpperCase()}'S TEST RESULTS`)
            .setThumbnail(`https://mc-heads.net/body/${ign}/right.png`) // Genuine 3D isometric view
            .setColor(0xF1C40F) // Yellow/Gold
            .setDescription(
                `**TESTER:**\n<@${tester || '123'}>\n\n` +
                `**USER:**\n<@${user.id || user}>\n\n` +
                `**REGION:**\n${region || 'Unknown'}\n\n` +
                `**IGN:**\n${ign}\n\n` +
                `**PREVIOUS TIER:**\n${oldTier}\n\n` +
                `**TIER EARNED:**\n${newTier}\n\n` +
                `**GAMEMODE:**\n${category}`
            )
            .setTimestamp();

        // If we have a kit logo, we can't easily set two thumbnails. 
        // We'll prioritize the kit logo as the main visual if provided, or keep the head.
        // Actually, let's use the player head and maybe add the kit logo as a small footer or just keep it as is if thumbnails are messy.
        // Usually, setThumbnail overrides. Let's stick to the kit logo if it's a "kit panel" but for results, maybe the player head is better?
        // User asked to "add this lgo to kit logs in panel". 
        // Let's use the kit logo as the thumbnail if available.
        // User wants user skin instead of kit logo for results
        // if (logo) embed.setThumbnail(logo);

        return embed;
    },
    evaluationEmbed: () => {
        return new EmbedBuilder()
            .setTitle('Evaluation Testing Waitlist & Roles')
            .setColor(0x2b2d31)
            .setDescription(
                `**Step 1: Register Your Profile**\n` +
                `Click the \`Register / Update Profile\` button to set your in-game details.\n\n` +
                `**Step 2: Get a Waitlist Role**\n` +
                `After registering, select any gamemode below to get the corresponding waitlist role. Each role has a **5-day cooldown**.\n\n` +
                `• **Region:** The server region you wish to test on (\`NA\`, \`EU\`, \`AS/AU\`).\n` +
                `• **Username:** The name of the account you will be testing on.`
            )
            .setFooter({ text: '🪓 Failure to provide authentic information will result in a denied test.' });
    },
    registrationSuccessEmbed: (user, ign, region, accountType, uuid) => {
        return new EmbedBuilder()
            .setTitle('✅ Profile Registration Complete!')
            .setColor(0x2ecc71)
            .setDescription('Your profile has been successfully saved.')
            .addFields(
                { name: '👤 Username', value: ign, inline: true },
                { name: '🌐 Region', value: region, inline: true },
                { name: '⚙️ Account Type', value: accountType, inline: true },
                { name: '🆔 UUID', value: `\`${uuid}\`` }
            )
            .setFooter({ text: 'You can now select gamemode roles from the registration panel! • Today' });
    },
    kitQueueOpenEmbed: (kit, players = [], testers = []) => {
        let testerList = testers.length > 0 ? testers.map(id => `• <@${id}>`).join('\n') : '• _No testers available_';
        let queueList = players.length > 0
            ? players.map((u, i) => `\`${i + 1 < 10 ? '0' + (i + 1) : i + 1}\` <@${u.user_id}>`).join('\n')
            : 'Queue empty';

        const kitLower = kit.toLowerCase();
        let thumbnail = `attachment://${kitLower}.png`;

        // Fallback for grouped files
        const validKits = ['nethpot', 'sword', 'axe', 'diapot', 'uhc', 'smpkit', 'crystal', 'mace'];
        if (!validKits.includes(kitLower)) {
            if (['nethpot', 'diapot', 'uhc'].includes(kitLower)) thumbnail = 'attachment://pots.png';
            else if (['sword', 'axe', 'smpkit'].includes(kitLower)) thumbnail = 'attachment://sword_axe.png';
            else if (['crystal', 'mace'].includes(kitLower)) thumbnail = 'attachment://crystal_mace.png';
            else thumbnail = null;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Queue for ${kit} is Open ✅`)
            .setColor(0x2ecc71)
            .setDescription(
                `**Available Testers**\n${testerList}\n\n` +
                `👤 **Queue**\n${queueList}`
            )
            .setFooter({ text: 'RearMC • Testing session in progress' })
            .setTimestamp();

        if (thumbnail) embed.setThumbnail(thumbnail);
        return embed;
    },
    kitQueueClosedEmbed: (kit, reason = 'Waiting for a tester to start the session.') => {
        const kitLower = kit.toLowerCase();
        let thumbnail = `attachment://${kitLower}.png`;

        // Fallback for grouped files
        const validKits = ['nethpot', 'sword', 'axe', 'diapot', 'uhc', 'smpkit', 'crystal', 'mace'];
        if (!validKits.includes(kitLower)) {
            if (['nethpot', 'diapot', 'uhc'].includes(kitLower)) thumbnail = 'attachment://pots.png';
            else if (['sword', 'axe', 'smpkit'].includes(kitLower)) thumbnail = 'attachment://sword_axe.png';
            else if (['crystal', 'mace'].includes(kitLower)) thumbnail = 'attachment://crystal_mace.png';
            else thumbnail = null;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Queue for ${kit} is Closed`)
            .setColor(0xe74c3c)
            .setDescription(`**Status:** Offline\n\n${reason}`)
            .setFooter({ text: 'RearMC • Keep an eye on announcements' })
            .setTimestamp();

        if (thumbnail) embed.setThumbnail(thumbnail);
        return embed;
    },
    testerLeaderboardEmbed: (leaderboard) => {
        const embed = new EmbedBuilder()
            .setTitle('🏆 TESTER LEADERBOARD')
            .setColor(0xF1C40F) // Gold
            .setDescription('Top testers and their total tests performed.')
            .setTimestamp()
            .setFooter({ text: 'RearMC • Tester Statistics' });

        if (leaderboard.length === 0) {
            embed.setDescription('No tests have been recorded yet.');
        } else {
            let description = '';
            leaderboard.forEach((data, index) => {
                const trophy = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
                description += `${trophy} **#${index + 1}** <@${data.tester_id}> — \`${data.test_count}\` tests\n`;
            });
            embed.setDescription(description);
            
            // Highlight Top 1
            if (leaderboard[0]) {
                embed.addFields({ name: '🌟 Top Tester', value: `<@${leaderboard[0].tester_id}> is leading with \`${leaderboard[0].test_count}\` tests!` });
            }
        }

        return embed;
    }
};
