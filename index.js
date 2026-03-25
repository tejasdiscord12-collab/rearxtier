const { Client, GatewayIntentBits, Collection, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting bot process...');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // process.exit(1); // Avoid crashing for non-fatal errors
});

console.log('📦 Loading configuration...');
const config = require('./utils/config');
console.log('🗄️ Initializing database manager...');
const db = require('./database/manager');
console.log('✨ Loading embeds...');
const embeds = require('./utils/embeds');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

// Cooldowns and Channel Restrictions
const cooldowns = new Collection();
const COOLDOWN_TIME = 3 * 60 * 1000; // 3 minutes

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Auto-lock all waitlist channels on startup
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];
        const testerRoleId = getId('tester_role', 'TESTER_ROLE_ID');
        const staffRoleId = getId('staff_role', 'STAFF_ROLE_ID');

        for (const kit of kits) {
            const channelId = db.getWaitlistChannel(kit);
            if (!channelId) continue;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) continue;

            const permissionOverwrites = [
                // @everyone: hidden and cannot type
                { id: guild.id, deny: ['ViewChannel', 'SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions'] }
            ];

            // Tester & Staff roles: full access
            if (testerRoleId) permissionOverwrites.push({ id: testerRoleId, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] });
            if (staffRoleId) permissionOverwrites.push({ id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] });

            // All existing overrides: roles get SendMessages denied, members get view-only
            for (const [id, overwrite] of channel.permissionOverwrites.cache) {
                if (id === guild.id || id === testerRoleId || id === staffRoleId) continue;
                if (overwrite.type === 0) {
                    // Role — deny typing
                    permissionOverwrites.push({ id, deny: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads'] });
                } else if (overwrite.type === 1) {
                    // Member — view only
                    permissionOverwrites.push({ id, allow: ['ViewChannel'], deny: ['SendMessages'] });
                }
            }

            await channel.permissionOverwrites.set(permissionOverwrites).catch(() => { });

            // Sync Panels (Refresh logos/content)
            await updateKitPanel(guild, kit);
        }
        console.log('✅ Waitlist channels locked and panels synced on startup.');
    } catch (e) {
        console.error('Failed to auto-lock waitlist channels on startup:', e);
    }
});

// Helper to get ID from DB or Env
function getId(key, envKey) {
    return db.getSetting(key) || config[envKey];
}

function getKitFiles(kit) {
    const kitLower = kit.toLowerCase();
    const assetsDir = path.join(__dirname, 'assets');
    const files = [];

    // Check if individual kit file exists
    const kitFile = path.join(assetsDir, `${kitLower}.png`);
    if (fs.existsSync(kitFile)) {
        files.push({ attachment: kitFile, name: `${kitLower}.png` });
    } else {
        // Fallback to legacy grouped files if individual not found
        if (['nethpot', 'diapot', 'uhc'].includes(kitLower)) {
            files.push({ attachment: path.join(assetsDir, 'pots.png'), name: 'pots.png' });
        } else if (['sword', 'axe', 'smpkit'].includes(kitLower)) {
            files.push({ attachment: path.join(assetsDir, 'sword_axe.png'), name: 'sword_axe.png' });
        } else if (['crystal', 'mace'].includes(kitLower)) {
            files.push({ attachment: path.join(assetsDir, 'crystal_mace.png'), name: 'crystal_mace.png' });
        }
    }

    return files;
}

client.on(Events.InteractionCreate, async interaction => {
    try {
        // 1. Slash Commands
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const staffId = getId('staff_role', 'STAFF_ROLE_ID');
            const testerId = getId('tester_role', 'TESTER_ROLE_ID');

            console.log(`[DEBUG] Interaction: ${interaction.type} | ID: ${interaction.commandName || commandName} | User: ${interaction.user.tag}`);

            if (commandName === 'setup') {
                await interaction.deferReply({ ephemeral: true });
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply({ content: 'Only Administrators can use this command.' });
                }
                const sub = interaction.options.getSubcommand();
                const type = interaction.options.getString('type');

                if (sub === 'role') {
                    const role = interaction.options.getRole('role');
                    db.updateSetting(type, role.id);
                    await interaction.editReply({ content: `✅ Updated **${type}** to ${role}.` });
                } else if (sub === 'channel') {
                    const channel = interaction.options.getChannel('channel');
                    db.updateSetting(type, channel.id);
                    if (type === 'queue_log_channel') {
                        db.updateSetting('queue_message_id', '');
                        updateLiveQueue(interaction.guild);
                    }
                    await interaction.editReply({ content: `✅ Updated **${type}** to ${channel}.` });
                } else if (sub === 'bot') {
                    const embed = embeds.evaluationEmbed();

                    const regButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('register_profile').setLabel('Register / Update Profile').setStyle(ButtonStyle.Success)
                    );

                    const kitSelect = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('gamemode_select')
                            .setPlaceholder('Select a gamemode to get the waitlist role')
                            .addOptions([
                                { label: 'Nethpot', value: 'Nethpot' },
                                { label: 'Sword', value: 'Sword' },
                                { label: 'Axe', value: 'Axe' },
                                { label: 'Diapot', value: 'Diapot' },
                                { label: 'UHC', value: 'UHC' },
                                { label: 'SmpKit', value: 'SmpKit' },
                                { label: 'Crystal', value: 'Crystal' },
                                { label: 'Mace', value: 'Mace' }
                            ])
                    );

                    const channel = interaction.options.getChannel('channel');
                    await channel.send({ embeds: [embed], components: [regButton, kitSelect] });
                    await interaction.editReply({ content: `✅ Evaluation panel sent to ${channel}.` });
                }
                return;
            }

            if (commandName === 'tiertest') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff or Testers can use this command.', ephemeral: true });
                }
                const sub = interaction.options.getSubcommand();
                await interaction.deferReply({ ephemeral: true });

                if (sub === 'start') {
                    const channelName = interaction.channel.name;
                    const kit = channelName.includes('-') ? channelName.split('-').pop().toUpperCase() : channelName.toUpperCase();

                    // Try to delete old panel to avoid duplicates
                    const oldMsgId = db.getSetting(`kit_msg_${kit.toLowerCase()}`);
                    if (oldMsgId) {
                        try {
                            const oldMsg = await interaction.channel.messages.fetch(oldMsgId);
                            if (oldMsg) await oldMsg.delete().catch(() => { });
                        } catch (e) { }
                    }

                    // Clear the queue for this kit to start fresh
                    db.clearQueueCategory(kit);

                    db.setQueueStatus(true);

                    const q = db.getQueue().filter(u => u.category.toUpperCase() === kit);
                    const roleId = db.getWaitlistRole(kit);
                    const roleMention = roleId ? `<@&${roleId}> Wait-list` : `**${kit} Wait-list**`;

                    const embed = embeds.kitQueueOpenEmbed(kit, q, [interaction.user.id]);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`enter_queue_${kit}`).setLabel('Join Queue').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`leave_queue_${kit}`).setLabel('Leave Queue').setStyle(ButtonStyle.Danger)
                    );

                    const files = getKitFiles(kit);
                    const msg = await interaction.channel.send({
                        content: roleMention,
                        embeds: [embed],
                        components: [row]
                    });
                    db.updateSetting(`kit_msg_${kit.toLowerCase()}`, msg.id);
                    db.updateSetting(`kit_channel_${kit.toLowerCase()}`, interaction.channel.id);
                    db.updateSetting(`kit_tester_${kit.toLowerCase()}`, interaction.user.id);

                    await interaction.editReply({ content: `✅ ${kit} Queue Opened.` });
                    updateLiveQueue(interaction.guild);
                } else if (sub === 'stop') {
                    const channelName = interaction.channel.name;
                    const kit = channelName.includes('-') ? channelName.split('-').pop().toUpperCase() : channelName.toUpperCase();

                    // Delete the open queue panel
                    const oldMsgId = db.getSetting(`kit_msg_${kit.toLowerCase()}`);
                    if (oldMsgId) {
                        try {
                            const oldMsg = await interaction.channel.messages.fetch(oldMsgId);
                            if (oldMsg) await oldMsg.delete().catch(() => { });
                        } catch (e) { }
                        db.updateSetting(`kit_msg_${kit.toLowerCase()}`, '');
                    }

                    const files = getKitFiles(kit);
                    const embed = embeds.kitQueueClosedEmbed(kit);
                    await interaction.channel.send({ embeds: [embed] });
                    db.setQueueStatus(false);
                    db.clearQueueCategory(kit);
                    await interaction.editReply({ content: `✅ ${kit} Queue Closed and panel removed.` });
                    updateLiveQueue(interaction.guild);
                }
                return;
            }

            if (commandName === 'waitlist-channel') {
                if (!interaction.member.permissions.has('Administrator')) return;
                const sub = interaction.options.getSubcommand();
                if (sub === 'add') {
                    const kit = interaction.options.getString('kit').toUpperCase();
                    const channel = interaction.options.getChannel('channel');
                    db.setWaitlistChannel(kit, channel.id);

                    const embed = embeds.kitQueueClosedEmbed(kit, 'Waiting for a tester to start the session.');
                    await channel.send({ embeds: [embed] });

                    await interaction.reply({ content: `✅ Waitlist channel for **${kit}** set to ${channel} and initialized with the closed panel.`, ephemeral: true });
                } else if (sub === 'create') {
                    await interaction.deferReply({ ephemeral: true });

                    const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];

                    // 1. Find or create the Category
                    let category = interaction.guild.channels.cache.find(c => c.name === 'Waitlists' && c.type === 4);
                    if (!category) {
                        try {
                            category = await interaction.guild.channels.create({
                                name: 'Waitlists',
                                type: 4,
                                permissionOverwrites: [
                                    {
                                        id: interaction.guild.id,
                                        deny: ['ViewChannel']
                                    }
                                ]
                            });
                            // Short pause to let Discord's API catch up
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (err) {
                            return interaction.editReply({ content: '❌ Failed to create the "Waitlists" category. Please check bot permissions.' });
                        }
                    } else {
                        // Sync category permissions
                        await category.permissionOverwrites.edit(interaction.guild.id, {
                            ViewChannel: false
                        }).catch(() => { });
                    }

                    let createdCount = 0;
                    for (const kitName of kits) {
                        try {
                            const channelName = `waitlist-${kitName.toLowerCase()}`;

                            // Check if channel already exists
                            let channel = interaction.guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);

                            if (!channel) {
                                channel = await interaction.guild.channels.create({
                                    name: channelName,
                                    parent: category.id,
                                    permissionOverwrites: [
                                        {
                                            id: interaction.guild.id,
                                            deny: ['ViewChannel', 'SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads']
                                        }
                                    ]
                                });

                                db.setWaitlistChannel(kitName, channel.id);

                                const embed = embeds.kitQueueClosedEmbed(kitName, 'Waiting for a tester to start the session.');
                                await channel.send({ embeds: [embed] });
                                createdCount++;

                                // Prevent spamming API too fast
                                await new Promise(resolve => setTimeout(resolve, 500));
                            } else {
                                // Enforce secure permissions on existing channel
                                await channel.permissionOverwrites.edit(interaction.guild.id, {
                                    ViewChannel: false,
                                    SendMessages: false,
                                    CreatePublicThreads: false,
                                    CreatePrivateThreads: false,
                                    SendMessagesInThreads: false
                                }).catch(() => { });
                            }
                        } catch (err) {
                            console.error(`Error creating channel for ${kitName}:`, err);
                        }
                    }

                    await interaction.editReply({ content: `✅ Successfully created and linked **${createdCount}** waitlist channels in the **Waitlists** category.` });
                }
                return;
            }

            if (commandName === 'waitlist-role') {
                if (!interaction.member.permissions.has('Administrator')) return;
                const sub = interaction.options.getSubcommand();
                if (sub === 'add') {
                    const kit = interaction.options.getString('kit').toUpperCase();
                    const role = interaction.options.getRole('role');
                    db.setWaitlistRole(kit, role.id);
                    await interaction.reply({ content: `✅ Waitlist role for **${kit}** set to ${role}.`, ephemeral: true });
                } else if (sub === 'create') {
                    await interaction.deferReply({ ephemeral: true });
                    const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];
                    let createdCount = 0;
                    for (const kitName of kits) {
                        let role = interaction.guild.roles.cache.find(r => r.name === `${kitName} Waitlist`);
                        if (!role) {
                            try {
                                role = await interaction.guild.roles.create({
                                    name: `${kitName} Waitlist`,
                                    reason: 'Automatic setup of waitlist roles'
                                });
                                createdCount++;
                            } catch (err) {
                                console.error(`Failed to create role for ${kitName}:`, err);
                                continue;
                            }
                        }
                        db.setWaitlistRole(kitName, role.id);
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    await interaction.editReply({ content: `✅ Successfully created and linked **${createdCount}** waitlist roles.` });
                }
                return;
            }
            if (commandName === 'autoroles') {
                if (!interaction.member.permissions.has('Administrator')) return;
                const sub = interaction.options.getSubcommand();
                if (sub === 'setup') {
                    await interaction.deferReply({ ephemeral: true });
                    const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];

                    // 1. Setup Roles
                    let rolesCreated = 0;
                    for (const kitName of kits) {
                        let role = interaction.guild.roles.cache.find(r => r.name === `${kitName} Waitlist`);
                        if (!role) {
                            role = await interaction.guild.roles.create({ name: `${kitName} Waitlist` }).catch(() => null);
                            if (role) rolesCreated++;
                        }
                        if (role) db.setWaitlistRole(kitName, role.id);
                    }

                    // 2. Setup Category & Channels
                    let category = interaction.guild.channels.cache.find(c => c.name === 'Waitlists' && c.type === 4);
                    if (!category) {
                        category = await interaction.guild.channels.create({
                            name: 'Waitlists',
                            type: 4,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: ['ViewChannel']
                                }
                            ]
                        }).catch(() => null);
                    } else {
                        await category.permissionOverwrites.edit(interaction.guild.id, {
                            ViewChannel: false
                        }).catch(() => { });
                    }

                    let channelsCreated = 0;
                    if (category) {
                        for (const kitName of kits) {
                            const channelName = `waitlist-${kitName.toLowerCase()}`;
                            let channel = interaction.guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);
                            if (!channel) {
                                channel = await interaction.guild.channels.create({
                                    name: channelName,
                                    parent: category.id,
                                    permissionOverwrites: [
                                        {
                                            id: interaction.guild.id,
                                            deny: ['ViewChannel', 'SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads']
                                        }
                                    ]
                                }).catch(() => null);

                                if (channel) {
                                    db.setWaitlistChannel(kitName, channel.id);
                                    const embed = embeds.kitQueueClosedEmbed(kitName, 'Waiting for a tester to start the session.');
                                    await channel.send({ embeds: [embed] }).catch(() => { });
                                    channelsCreated++;
                                }
                            } else {
                                // Enforce secure permissions even on existing channels
                                await channel.permissionOverwrites.edit(interaction.guild.id, {
                                    ViewChannel: false,
                                    SendMessages: false,
                                    CreatePublicThreads: false,
                                    CreatePrivateThreads: false,
                                    SendMessagesInThreads: false
                                }).catch(() => { });
                            }
                        }
                    }

                    await interaction.editReply({
                        content: `✅ **Setup Complete!**\n\n` +
                            `🎭 Roles Linked: **${kits.length}** (${rolesCreated} new)\n` +
                            `📺 Channels Linked: **${kits.length}** (${channelsCreated} new)\n\n` +
                            `Players will now automatically get roles and channel access when they join a waitlist.`
                    });
                }
                return;
            }

            if (commandName === 'apply-test') {
                const embed = embeds.createBaseEmbed('Tier Test Application', 'Click the button below to start your application and join the testing queue.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_apply').setLabel('Apply for Test').setStyle(ButtonStyle.Primary)
                );
                await interaction.reply({ embeds: [embed], components: [row] });
            }

            if (commandName === 'tester') {
                if (!interaction.member.roles.cache.has(staffId)) {
                    return interaction.reply({ content: 'Only Staff can manage testers.', ephemeral: true });
                }
                const sub = interaction.options.getSubcommand();
                const target = interaction.options.getMember('user');
                if (sub === 'add') {
                    await target.roles.add(testerId);
                    await interaction.reply({ content: `✅ Added Tester role to ${target}.`, ephemeral: true });
                } else if (sub === 'remove') {
                    await target.roles.remove(testerId);
                    await interaction.reply({ content: `❌ Removed Tester role from ${target}.`, ephemeral: true });
                }
            }

            if (commandName === 'open-queue') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff or Testers can open the queue.', ephemeral: true });
                }
                db.setQueueStatus(true);
                const q = db.getQueue();
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('join_queue').setLabel('Join Queue').setStyle(ButtonStyle.Success)
                );
                await interaction.reply({ embeds: [embeds.queueOpenEmbed(q.length)], components: [row] });
            }

            if (commandName === 'next') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff or Testers can call the next player.', ephemeral: true });
                }

                const channelName = interaction.channel.name;
                const channelKit = channelName.includes('-') ? channelName.split('-').pop().toUpperCase() : null;

                let q = db.getQueue();
                if (channelKit) {
                    q = q.filter(u => u.category.toUpperCase() === channelKit);
                }

                if (q.length === 0) {
                    return interaction.reply({ content: `The ${channelKit || ''} queue is empty.`, ephemeral: true });
                }

                const nextUser = q[0];
                db.removeFromQueue(nextUser.user_id);

                // Auto-create ticket
                const userData = db.getUser(nextUser.user_id);
                const ign = userData ? userData.minecraft_ign : 'Unknown';
                const region = userData ? userData.region : 'Global';
                const accType = userData ? userData.account_type : 'Premium';
                const ticketCategoryId = '1479077066258382989';

                try {
                    const ticketChannel = await interaction.guild.channels.create({
                        name: `test-${ign}-${nextUser.category}`,
                        parent: ticketCategoryId,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: ['ViewChannel'] },
                            { id: nextUser.user_id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                            { id: staffId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                            { id: testerId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] }
                        ]
                    });

                    const detailsEmbed = new EmbedBuilder()
                        .setTitle('Player Registration Details')
                        .setColor('#2b2d31')
                        .addFields(
                            { name: 'Minecraft IGN', value: `\`${ign}\``, inline: true },
                            { name: 'Region', value: `\`${region}\``, inline: true },
                            { name: 'Account Type', value: `\`${accType}\``, inline: true },
                            { name: 'Kit Category', value: `\`${nextUser.category}\``, inline: true }
                        )
                        .setTimestamp();

                    const ticketEmbed = embeds.createBaseEmbed('Tier Test Session', `Ticket created for <@${nextUser.user_id}>'s **${nextUser.category}** test.`);
                    const closeRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );

                    await ticketChannel.send({ content: `<@${nextUser.user_id}> | ${interaction.user} | <@&${testerId}>`, embeds: [ticketEmbed, detailsEmbed], components: [closeRow] });

                    // DM the player privately
                    const player = await client.users.fetch(nextUser.user_id).catch(() => null);
                    if (player) {
                        player.send(`🔔 Your **${nextUser.category}** tier test ticket has been created! Head over to <#${ticketChannel.id}> to start your test with the tester.`).catch(() => { });
                    }

                    await interaction.reply({ content: `✅ Ticket created: <#${ticketChannel.id}>`, ephemeral: true });
                } catch (e) {
                    console.error('Failed to create ticket on /next:', e);
                    await interaction.reply({ content: `❌ Ticket creation failed - check my permissions in the ticket category.`, ephemeral: true });
                }

                updateLiveQueue(interaction.guild);
                if (nextUser.category) updateKitPanel(interaction.guild, nextUser.category);
            }

            if (commandName === 'queue') {
                const q = db.getQueue();
                if (q.length === 0) return interaction.reply({ content: 'The queue is currently empty.', ephemeral: true });

                const list = q.map((u, i) => `**#${i + 1}** - <@${u.user_id}> (${u.category})`).join('\n');
                const embed = embeds.createBaseEmbed('Current Testing Queue', list);
                await interaction.reply({ embeds: [embed] });
            }

            if (commandName === 'close-queue') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff or Testers can close the queue.', ephemeral: true });
                }
                db.setQueueStatus(false);
                await interaction.reply({ embeds: [embeds.queueClosedEmbed()] });
                updateLiveQueue(interaction.guild);
            }

            if (commandName === 'lockwaitlists') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Administrators can use this.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];
                const testerRoleId = getId('tester_role', 'TESTER_ROLE_ID');
                const staffRoleId = getId('staff_role', 'STAFF_ROLE_ID');
                let channelsDone = 0;

                for (const kit of kits) {
                    const channelId = db.getWaitlistChannel(kit);
                    if (!channelId) continue;
                    const channel = interaction.guild.channels.cache.get(channelId);
                    if (!channel) continue;

                    // Build a fresh, clean permission set for the channel
                    const permissionOverwrites = [
                        // @everyone: cannot see OR type
                        { id: interaction.guild.id, deny: ['ViewChannel', 'SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions'] }
                    ];

                    // Preserve tester/staff access with full permissions
                    if (testerRoleId) permissionOverwrites.push({ id: testerRoleId, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] });
                    if (staffRoleId) permissionOverwrites.push({ id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] });

                    // For all existing overrides: roles get denied SendMessages, members get ViewChannel only
                    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
                        if (id === interaction.guild.id) continue; // skip @everyone, already set
                        if (id === testerRoleId || id === staffRoleId) continue; // skip tester/staff, already set
                        if (overwrite.type === 0) {
                            // Role override - deny SendMessages but keep whatever else
                            permissionOverwrites.push({ id, deny: ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads'] });
                        } else if (overwrite.type === 1) {
                            // Member override - view only, no typing
                            permissionOverwrites.push({ id, allow: ['ViewChannel'], deny: ['SendMessages'] });
                        }
                    }

                    await channel.permissionOverwrites.set(permissionOverwrites).catch(() => { });
                    channelsDone++;
                }
                await interaction.editReply({ content: `✅ Done! Fully locked **${channelsDone}** waitlist channels. Only testers/staff can type — players can only see the panel and click buttons.` });
            }

            if (commandName === 'waitlist-tester') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Administrators can use this.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const sub = interaction.options.getSubcommand();
                const tester = interaction.options.getUser('user');
                const role = interaction.options.getRole('role');

                if (!tester && !role) {
                    return interaction.editReply({ content: '❌ Please provide a user and/or a role.' });
                }

                const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];
                let count = 0;

                for (const kit of kits) {
                    const channelId = db.getWaitlistChannel(kit);
                    if (!channelId) continue;
                    const channel = interaction.guild.channels.cache.get(channelId);
                    if (!channel) continue;

                    if (sub === 'add') {
                        const perms = { ViewChannel: true, SendMessages: true, ManageMessages: true };
                        if (tester) await channel.permissionOverwrites.edit(tester.id, perms).catch(() => { });
                        if (role) await channel.permissionOverwrites.edit(role.id, perms).catch(() => { });
                    } else if (sub === 'remove') {
                        if (tester) await channel.permissionOverwrites.delete(tester.id).catch(() => { });
                        if (role) await channel.permissionOverwrites.delete(role.id).catch(() => { });
                    }
                    count++;
                }

                const targets = [tester?.username, role?.name].filter(Boolean).join(' & ');
                const action = sub === 'add' ? 'granted full access to' : 'removed from';
                await interaction.editReply({ content: `\u2705 **${targets}** has been ${action} **${count}** waitlist channels.` });
            }

            if (commandName === 'registered') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff can use this command.', ephemeral: true });
                }

                const users = db.getAllTiers();
                if (users.length === 0) {
                    return interaction.reply({ content: 'No players are currently registered.', ephemeral: true });
                }

                const embedsList = [];
                let currentEmbed = new EmbedBuilder()
                    .setTitle('Registered Players & Tiers')
                    .setColor('#2b2d31')
                    .setTimestamp();

                let description = '';
                users.forEach((user, index) => {
                    const tiersStr = user.tiers && user.tiers.length > 0
                        ? user.tiers.map(t => `${t.category}: ${t.tier}`).join(', ')
                        : 'No Tiers';
                    const line = `**${index + 1}.** <@${user.user_id}> (\`${user.minecraft_ign}\`)\nRegion: ${user.region} | Tiers: ${tiersStr}\n\n`;

                    if ((description + line).length > 2000) {
                        currentEmbed.setDescription(description);
                        embedsList.push(currentEmbed);
                        currentEmbed = new EmbedBuilder().setTitle('Registered Players (Continued)').setColor('#2b2d31');
                        description = line;
                    } else {
                        description += line;
                    }
                });

                currentEmbed.setDescription(description || 'No players found.');
                embedsList.push(currentEmbed);

                await interaction.reply({ embeds: [embedsList[0]], ephemeral: true });
                for (let i = 1; i < embedsList.length; i++) {
                    await interaction.followUp({ embeds: [embedsList[i]], ephemeral: true });
                }
            }

            if (commandName === 'remove-tier') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Only Staff or Testers can remove tiers.', ephemeral: true });
                }

                const targetUser = interaction.options.getUser('user');
                const gamemode = interaction.options.getString('gamemode');

                const removed = db.removeUserTier(targetUser.id, gamemode);
                if (removed) {
                    await interaction.reply({
                        content: `✅ Removed **${gamemode}** tier from <@${targetUser.id}>. The website will update within 30 seconds.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `❌ Could not find a **${gamemode}** tier for <@${targetUser.id}>. Check the gamemode name and try again.`,
                        ephemeral: true
                    });
                }
                return;
            }

            if (commandName === 'tester-result') {
                const leaderboard = db.getTesterLeaderboard();
                const embed = embeds.testerLeaderboardEmbed(leaderboard);
                await interaction.reply({ embeds: [embed] });
                return;
            }

            if (commandName === 'admin-sync') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Administrators can use this command.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                try {
                    db.saveJson();
                    await interaction.editReply({ content: '✅ Manual synchronization triggered successfully! The website should update in a few seconds.' });
                } catch (e) {
                    await interaction.editReply({ content: `❌ Sync failed: ${e.message}` });
                }
                return;
            }

            if (commandName === 'result') {
                const userId = interaction.user.id;
                const now = Date.now();
                const timestamps = cooldowns.get('result') || new Collection();
                if (timestamps.has(userId)) {
                    const expirationTime = timestamps.get(userId) + COOLDOWN_TIME;
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return interaction.reply({ content: `⚠️ Please wait **${timeLeft.toFixed(1)}s** before posting another result.`, ephemeral: true });
                    }
                }

                const sub = interaction.options.getSubcommand();
                if (sub === 'create') {
                    if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId)) {
                        return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
                    }
                    const user = interaction.options.getUser('user');
                    const ign = interaction.options.getString('ign');
                    const newTier = interaction.options.getString('tier-earned');
                    const category = interaction.options.getString('gamemode');
                    const region = interaction.options.getString('region');
                    const tester = interaction.options.getUser('tester') || interaction.user;

                    // Automatically fetch old tier if they have one
                    const userData = db.getUserTiers(user.id);
                    let oldTier = 'N/A';
                    if (userData && userData.tiers) {
                        const existingKitTier = userData.tiers.find(t => t.category.toLowerCase() === category.toLowerCase());
                        if (existingKitTier) {
                            oldTier = existingKitTier.tier;
                        }
                    }

                    const embed = embeds.testResultEmbed(user, ign, oldTier, newTier, category, region, tester.id);

                    // Update Database
                    db.updateUserTier(user.id, ign, newTier, category, region);
                    db.logTest(tester.id, user.id, ign, category, newTier);

                    const channelIds = db.getResultChannels();

                    if (channelIds.length === 0) {
                        return interaction.reply({ content: '❌ No result channels configured! Use `/results-channel add` to set them.', ephemeral: true });
                    }


                    // Apply Cooldown after successful validation
                    timestamps.set(userId, now);
                    cooldowns.set('result', timestamps);
                    setTimeout(() => timestamps.delete(userId), COOLDOWN_TIME);

                    let sentCount = 0;
                    for (const id of channelIds) {
                        const channel = interaction.guild.channels.cache.get(id);
                        if (channel) {
                            const msg = await channel.send({
                                content: `<@${user.id}>`,
                                embeds: [embed]
                            });
                            await msg.react('✅').catch(() => { });
                            sentCount++;
                        }
                    }

                    await interaction.reply({ content: `✅ Result posted for **${ign}** in ${sentCount} channel(s)!`, ephemeral: true });
                } else if (sub === 'repost') {
                    if (!interaction.member.permissions.has('Administrator')) {
                        return interaction.reply({ content: 'Only Administrators can use this command.', ephemeral: true });
                    }

                    const manualChannel = interaction.options.getChannel('channel');
                    let channelIds = db.getResultChannels();
                    if (manualChannel && !channelIds.includes(manualChannel.id)) {
                        channelIds.push(manualChannel.id);
                    }

                    if (channelIds.length === 0) {
                        return interaction.reply({ content: '❌ No result channels configured! Please use `/results-channel add` or specify a channel in the command.', ephemeral: true });
                    }

                    await interaction.deferReply({ ephemeral: true });
                    await interaction.editReply({ content: '⏳ Starting recovery: Re-posting all results from the database...' });

                    const allData = db.getAllTiers();
                    let repostCount = 0;

                    for (const userData of allData) {
                        if (!userData.tiers || userData.tiers.length === 0) continue;

                        for (const tierData of userData.tiers) {
                            const embed = embeds.testResultEmbed(
                                { id: userData.user_id },
                                userData.minecraft_ign || 'Unknown',
                                'Recovered',
                                tierData.tier,
                                tierData.category,
                                userData.region || 'Unknown',
                                interaction.user.id
                            );

                            for (const channelId of channelIds) {
                                const targetChannel = interaction.guild.channels.cache.get(channelId);
                                if (targetChannel) {
                                    try {
                                        await targetChannel.send({ content: `<@${userData.user_id}>`, embeds: [embed] });
                                        repostCount++;
                                        // Small delay to prevent rate limit spamming
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                    } catch (e) {
                                        console.error(`Failed to repost for ${userData.user_id} in ${channelId}:`, e);
                                    }
                                }
                            }
                        }
                    }

                    await interaction.followUp({ content: `✅ Successfully recovered and re-posted **${repostCount}** results.`, ephemeral: true });
                }
            }

            if (commandName === 'results-channel') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Administrators can use this command.', ephemeral: true });
                }
                const sub = interaction.options.getSubcommand();
                const channel = interaction.options.getChannel('channel');

                if (sub === 'add') {
                    const added = db.addResultChannel(channel.id);
                    await interaction.reply({ content: added ? `✅ Added ${channel} to results channels.` : `⚠️ ${channel} is already in the list.`, ephemeral: true });
                } else if (sub === 'remove') {
                    const removed = db.removeResultChannel(channel.id);
                    await interaction.reply({ content: removed ? `✅ Removed ${channel} from results channels.` : `⚠️ ${channel} was not in the list.`, ephemeral: true });
                }
            }

            if (commandName === 'embed') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'create') {
                    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'No permission.', ephemeral: true });
                    const color = interaction.options.getString('color');
                    let text = interaction.options.getString('text');

                    const emojiRegex = /(?<!<a?):([a-zA-Z0-9_]+):(?!\d+>)/g;
                    text = text.replace(emojiRegex, (match, emojiName) => {
                        const emoji = interaction.guild.emojis.cache.find(e => e.name === emojiName);
                        return emoji ? emoji.toString() : match;
                    });

                    const embed = new EmbedBuilder()
                        .setDescription(text)
                        .setColor(color.startsWith('#') ? color : `#${color}`);

                    await interaction.channel.send({ embeds: [embed] });
                    await interaction.reply({ content: '✅ Embed created!', ephemeral: true });
                }
            }

            if (commandName === 'tierpermission') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'add') {
                    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'No permission.', ephemeral: true });
                    const category = interaction.options.getString('category');
                    const result = interaction.options.getString('result');
                    await interaction.reply({ content: `✅ Added tier permission: **${category}** -> **${result}**`, ephemeral: true });
                }
            }

            if (commandName === 'leave') {
                db.removeFromQueue(interaction.user.id);
                await interaction.reply({ content: '✅ You have left the queue.', ephemeral: true });
                updateLiveQueue(interaction.guild);
            }

            if (commandName === 'position') {
                const pos = db.getQueuePosition(interaction.user.id);
                if (pos) {
                    await interaction.reply({ content: `Your current position is **#${pos}**.`, ephemeral: true });
                } else {
                    await interaction.reply({ content: 'You are not in the queue.', ephemeral: true });
                }
            }

            if (commandName === 'remove') {
                if (!interaction.member.roles.cache.has(staffId) && !interaction.member.roles.cache.has(testerId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: 'Only Staff or Testers can remove players from the queue.', ephemeral: true });
                }
                const target = interaction.options.getUser('user');
                db.removeFromQueue(target.id);
                await interaction.reply({ content: `✅ Removed ${target} from the queue.`, ephemeral: true });
                updateLiveQueue(interaction.guild);
            }
        }

    // 2. Buttons
    if (interaction.isButton()) {
        const staffId = getId('staff_role', 'STAFF_ROLE_ID');
        const testerId = getId('tester_role', 'TESTER_ROLE_ID');

        if (interaction.customId === 'start_apply') {
            const select = new StringSelectMenuBuilder()
                .setCustomId('select_kit')
                .setPlaceholder('Select the kit you want to be tested for...')
                .addOptions([
                    { label: 'Nethpot', value: 'Nethpot', emoji: '🧪' },
                    { label: 'Sword', value: 'Sword', emoji: '⚔️' },
                    { label: 'Axe', value: 'Axe', emoji: '🪓' },
                    { label: 'Diapot', value: 'Diapot', emoji: '💎' },
                    { label: 'UHC', value: 'UHC', emoji: '🍎' },
                    { label: 'SmpKit', value: 'SmpKit', emoji: '🏕️' },
                    { label: 'Crystal', value: 'Crystal', emoji: '🔮' },
                    { label: 'Mace', value: 'Mace', emoji: '⚒️' }
                ]);

            const row = new ActionRowBuilder().addComponents(select);
            await interaction.reply({ content: 'Please choose your kit category from the list below:', components: [row], ephemeral: true });
        }

        if (interaction.customId === 'start_ally_apply') {
            const modal = new ModalBuilder().setCustomId('ally_request_modal').setTitle('Ally Role Request');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('Minecraft IGN').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Current Tier').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proof').setLabel('Proof Link').setStyle(TextInputStyle.Short))
            );
            await interaction.showModal(modal);
        }

        // 'join_queue' is the old generic button - no longer used

        if (interaction.customId === 'register_profile') {
            const select = new StringSelectMenuBuilder()
                .setCustomId('reg_region_select')
                .setPlaceholder('Select your region')
                .addOptions([
                    { label: 'NA', value: 'NA', description: 'North America' },
                    { label: 'EU', value: 'EU', description: 'Europe' },
                    { label: 'AS/AU', value: 'AS/AU', description: 'Asia / Australia' }
                ]);
            const row = new ActionRowBuilder().addComponents(select);
            await interaction.reply({ content: '📊 **Profile Registration - Step 1/3**\nSelect your region:', components: [row], ephemeral: true });
        }
        if (interaction.customId.startsWith('approve_test_')) {
            if (!interaction.member.roles.cache.has(staffId)) {
                return interaction.reply({ content: 'Only Staff can verify applications.', ephemeral: true });
            }

            const payload = interaction.customId.split('_');
            const userId = payload[2];
            const kit = payload[3].toLowerCase();

            let targetChannelId = getId('queue_channel', 'QUEUE_CHANNEL_ID');
            if (kit.includes('sword')) targetChannelId = getId('sword_channel', 'SWORD_QUEUE_CHANNEL_ID');
            if (kit.includes('nethpot')) targetChannelId = getId('nethpot_channel', 'NETHPOT_QUEUE_CHANNEL_ID');

            const targetChannel = interaction.guild.channels.cache.get(targetChannelId);

            // 1. Assign Kit-Specific Waitlist Role
            const storedRoleId = db.getWaitlistRole(kit);
            let role = storedRoleId ? interaction.guild.roles.cache.get(storedRoleId) : null;
            if (!role) {
                const roleName = `${kit.charAt(0).toUpperCase() + kit.slice(1)} Waitlist`;
                role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase() || r.name.toLowerCase() === kit.toLowerCase());
            }

            if (role) {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.add(role).catch(() => { });

                // 2. Ensure the role has ViewChannel:true and SendMessages:false on the channel
                if (targetChannel) {
                    await targetChannel.permissionOverwrites.edit(role.id, {
                        ViewChannel: true,
                        SendMessages: false
                    }).catch(() => { });
                }
            }

            const files = getKitFiles(kit);
            await interaction.update({
                content: `\u2705 **Verified:** <@${userId}> for **${kit.toUpperCase()}**. Access granted to <#${targetChannelId}>.`,
                components: [],
                files: files
            });

            const user = await client.users.fetch(userId).catch(() => null);
            if (user) user.send(`\u2705 Approved for **${kit.toUpperCase()}**! Head to the waitlist channel and click **Join Queue** to enter.`).catch(() => { });
        }

        if (interaction.customId.startsWith('deny_test_')) {
            const userId = interaction.customId.split('_')[2];
            await interaction.update({ content: `❌ **Denied:** <@${userId}>.`, components: [] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('Closing ticket in 5 seconds...');
            setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
        }

        if (interaction.customId.startsWith('enter_queue_')) {
            const kit = interaction.customId.split('_')[2].toUpperCase();
            const user = db.getUser(interaction.user.id);

            if (!user || !user.minecraft_ign) {
                return interaction.reply({ content: '❌ You must register your profile first in the main registration channel!', ephemeral: true });
            }

            const pos = db.getQueuePosition(interaction.user.id);
            if (pos) return interaction.reply({ content: `Already in queue at #${pos}`, ephemeral: true });

            if (!db.isQueueOpen()) {
                return interaction.reply({ content: '🔴 This waitlist is currently closed. Please wait for a tester to open it!', ephemeral: true });
            }

            db.addToQueue(interaction.user.id, kit, Math.floor(Date.now() / 1000));
            await interaction.reply({ content: `✅ Entered **${kit}** queue!`, ephemeral: true });
            updateLiveQueue(interaction.guild);
            updateKitPanel(interaction.guild, kit);
        }

        if (interaction.customId.startsWith('leave_queue_')) {
            const kit = interaction.customId.split('_')[2];
            db.removeFromQueue(interaction.user.id);
            await interaction.reply({ content: `✅ Left the **${kit}** queue.`, ephemeral: true });
            updateLiveQueue(interaction.guild);
            updateKitPanel(interaction.guild, kit);
        }
    }

    // 2.1 Select Menus
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_kit') {
            const selectedKit = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`request_test_modal_${selectedKit}`).setTitle(`Tier Test: ${selectedKit}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('Minecraft IGN').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region (NA/EU/AS)').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'reg_region_select') {
            const region = interaction.values[0];
            const select = new StringSelectMenuBuilder()
                .setCustomId(`reg_acc_type_select_${region}`)
                .setPlaceholder('Select your account type')
                .addOptions([
                    { label: 'Premium (Official Minecraft)', value: 'Premium', emoji: '✅', description: 'Purchased from Mojang/Microsoft' },
                    { label: 'Cracked (Offline)', value: 'Cracked', emoji: '⚠️', description: 'Unofficial/Cracked client' }
                ]);
            const row = new ActionRowBuilder().addComponents(select);
            await interaction.update({ content: `📊 **Profile Registration - Step 2/3**\nSelected Region: \`${region}\`\n\nSelect your account type:`, components: [row] });
        }

        if (interaction.customId.startsWith('reg_acc_type_select_')) {
            const region = interaction.customId.split('_')[4];
            const accType = interaction.values[0];

            const modal = new ModalBuilder().setCustomId(`modal_registration_${region}_${accType}`).setTitle('Profile Registration - Step 3/3');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('In-Game Username (IGN)').setPlaceholder('Enter your Minecraft username').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'gamemode_select') {
            await interaction.deferReply({ ephemeral: true });
            const kit = interaction.values[0];
            const user = db.getUser(interaction.user.id);

            if (!user || !user.minecraft_ign) {
                return interaction.editReply({ content: '❌ You must register your profile first using the button above!' });
            }


            // 1. Assign Kit-Specific Waitlist Role
            const storedRoleId = db.getWaitlistRole(kit);
            let role = storedRoleId ? interaction.guild.roles.cache.get(storedRoleId) : null;

            if (!role) {
                const roleName = `${kit} Waitlist`;
                role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase() || r.name.toLowerCase() === kit.toLowerCase());
            }

            if (role) {
                await interaction.member.roles.add(role).catch(() => { });
            }

            // 2. Give the kit ROLE ViewChannel access (no SendMessages) on the channel
            const kitChannelId = db.getWaitlistChannel(kit);
            if (kitChannelId && role) {
                const channel = interaction.guild.channels.cache.get(kitChannelId);
                if (channel) {
                    await channel.permissionOverwrites.edit(role.id, {
                        ViewChannel: true,
                        SendMessages: false
                    }).catch(() => { });

                    if (channel.parent) {
                        await channel.parent.permissionOverwrites.edit(role.id, { ViewChannel: true }).catch(() => { });
                    }
                }
            }

            if (!db.isQueueOpen()) {
                return interaction.editReply({ content: `✅ You have been granted access to the **${kit}** waitlist channel, but the queue is currently **closed**. Please wait for a tester to open it!` });
            }

            const pos = db.getQueuePosition(interaction.user.id);
            if (pos) return interaction.editReply({ content: `Already in queue at #${pos}` });

            await interaction.editReply({ content: `✅ You have been granted access to the **${kit}** waitlist. Please head over to the waitlist channel to join the queue!` });
        }
    }

    // 3. Modals
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('request_test_modal_')) {
            const kit = interaction.customId.split('_')[3];
            const ign = interaction.fields.getTextInputValue('ign');
            const region = interaction.fields.getTextInputValue('region');

            const staffId = getId('staff_role', 'STAFF_ROLE_ID');
            const testerId = getId('tester_role', 'TESTER_ROLE_ID');
            const ticketCategoryId = getId('ticket_category', 'TICKET_CATEGORY_ID');

            // 1. Create the Ticket Channel
            const ticket = await interaction.guild.channels.create({
                name: `test-${ign}-${kit}`,
                parent: ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: ['ViewChannel'] },
                    { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages'] },
                    { id: staffId, allow: ['ViewChannel', 'SendMessages'] },
                    { id: testerId, allow: ['ViewChannel', 'SendMessages'] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle('New Verification Application')
                .addFields(
                    { name: 'User', value: `${interaction.user}` },
                    { name: 'IGN', value: ign, inline: true },
                    { name: 'Kit', value: kit, inline: true },
                    { name: 'Region', value: region, inline: true }
                ).setColor(0x3498db).setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`approve_test_${interaction.user.id}_${kit}`).setLabel('Verify').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`deny_test_${interaction.user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Secondary)
            );

            await ticket.send({ content: `<@&${staffId}>, <@&${testerId}> - New application!`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Application sent! Private ticket created: ${ticket}`, ephemeral: true });
        }
        // ... rest of modal submit

        if (interaction.customId === 'ally_request_modal') {
            const ign = interaction.fields.getTextInputValue('ign');
            const tier = interaction.fields.getTextInputValue('tier');
            const proof = interaction.fields.getTextInputValue('proof');

            const allyChannelId = getId('ally_channel', 'ALLY_REQUESTS_CHANNEL_ID');
            const channel = interaction.guild.channels.cache.get(allyChannelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🏆 New Ally Request')
                    .addFields(
                        { name: 'User', value: `${interaction.user}` },
                        { name: 'IGN', value: ign, inline: true },
                        { name: 'Tier', value: tier, inline: true },
                        { name: 'Proof', value: proof, inline: true }
                    ).setColor(0xf1c40f);
                await channel.send({ embeds: [embed] });
            }
            await interaction.reply({ content: '✅ Ally Request sent!', ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_registration_')) {
            const payload = interaction.customId.split('_');
            const region = payload[2];
            const accountType = payload[3];
            const ign = interaction.fields.getTextInputValue('ign');

            db.updateRegistration(interaction.user.id, ign, region, accountType);

            const uuid = Buffer.from(interaction.user.id).toString('hex').match(/.{1,8}/g).join('-'); // Dummy UUID for display
            const embed = embeds.registrationSuccessEmbed(interaction.user, ign, region, accountType, uuid);

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
} catch (error) {
        console.error('[CRITICAL] Global Interaction handler error:', error);
        try {
            if (interaction.isRepliable()) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true }).catch(() => { });
                } else {
                    await interaction.editReply({ content: 'An unexpected error occurred.' }).catch(() => { });
                }
            }
        } catch (e) { }
    }
});

// 4. Prefix Commands (!)
client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const staffId = getId('staff_role', 'STAFF_ROLE_ID');
    const testerId = getId('tester_role', 'TESTER_ROLE_ID');

    // Admin Setup
    if (commandName === 'setup') {
        if (!message.member.permissions.has('Administrator')) return;
        const type = args[0]; // e.g. staff_role, request_channel
        const targetId = message.mentions.roles.first()?.id || message.mentions.channels.first()?.id || args[1];

        if (!type || !targetId) {
            return message.reply('Usage: `!setup <type> <@role/#channel/ID>`\nTypes: `staff_role`, `tester_role`, `request_channel`, `queue_channel`, `sword_channel`, `nethpot_channel`, `logs_channel`, `ticket_category`, `results_channel`, `result_cmd_channel`, `queue_log_channel`');
        }
        db.updateSetting(type, targetId);
        if (type === 'queue_log_channel') {
            db.updateSetting('queue_message_id', '');
            updateLiveQueue(message.guild);
        }
        message.reply(`✅ Updated **${type}** settings.`);
    }

    if (commandName === 'apply-test') {
        const embed = embeds.createBaseEmbed('Tier Test Application', 'Click the button below to start your application and join the testing queue.');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_apply').setLabel('Apply for Test').setStyle(ButtonStyle.Primary)
        );
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (commandName === 'tester') {
        if (!message.member.roles.cache.has(staffId)) return;
        const sub = args[0];
        const target = message.mentions.members.first() || (args[1] ? await message.guild.members.fetch(args[1]).catch(() => null) : null);

        if (!target || !['add', 'remove'].includes(sub)) {
            return message.reply('Usage: `!tester <add/remove> <@user/ID>`');
        }

        if (sub === 'add') {
            await target.roles.add(testerId);
            message.reply(`✅ Added Tester role to ${target}.`);
        } else {
            await target.roles.remove(testerId);
            message.reply(`❌ Removed Tester role from ${target}.`);
        }
    }

    if (commandName === 'result') {
        const userId = message.author.id;
        const now = Date.now();
        const timestamps = cooldowns.get('result') || new Collection();
        if (timestamps.has(userId)) {
            const expirationTime = timestamps.get(userId) + COOLDOWN_TIME;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`⚠️ Please wait **${timeLeft.toFixed(1)}s** before posting another result.`);
            }
        }

        if (!message.member.roles.cache.has(staffId) && !message.member.roles.cache.has(testerId)) return;

        const sub = args[0];
        if (sub === 'create') {
            const user = message.mentions.users.first() || (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);
            const ign = args[2];
            const oldTier = args[3];
            const newTier = args[4];
            const category = args[5];
            const region = args[6] || 'Global';

            if (!user || !ign || !oldTier || !newTier || !category) {
                return message.reply('Usage: `!result create <@user> <IGN> <PrevTier> <NewTier> <Category> [Region]`');
            }

            const embed = embeds.testResultEmbed(user, ign, oldTier, newTier, category, region, message.author.id);

            // Update Database
            db.updateUserTier(user.id, ign, newTier, category, region);

            const channelIds = db.getResultChannels();
            if (channelIds.length === 0) return message.reply('❌ No result channels configured!');

            // Apply Cooldown
            timestamps.set(userId, now);
            cooldowns.set('result', timestamps);
            setTimeout(() => timestamps.delete(userId), COOLDOWN_TIME);

            let sentCount = 0;
            for (const id of channelIds) {
                const channel = message.guild.channels.cache.get(id);
                if (channel) {
                    const msg = await channel.send({
                        content: `<@${user.id}>`,
                        embeds: [embed]
                    });
                    await msg.react('✅').catch(() => { });
                    sentCount++;
                }
            }

            await message.reply(`✅ Result posted for **${ign}** in ${sentCount} channel(s)!`);
        }
    }

    if (commandName === 'open-queue') {
        if (!message.member.roles.cache.has(staffId) && !message.member.roles.cache.has(testerId) && !message.member.permissions.has('Administrator')) return;
        db.setQueueStatus(true);
        const q = db.getQueue();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_queue').setLabel('Join Queue').setStyle(ButtonStyle.Success)
        );
        await message.channel.send({ embeds: [embeds.queueOpenEmbed(q.length)], components: [row] });
    }

    if (commandName === 'close-queue') {
        if (!message.member.roles.cache.has(staffId) && !message.member.roles.cache.has(testerId) && !message.member.permissions.has('Administrator')) return;
        db.setQueueStatus(false);
        await message.channel.send({ embeds: [embeds.queueClosedEmbed()] });
    }

    if (commandName === 'leave-queue') {
        db.removeFromQueue(message.author.id);
        message.reply('✅ You have left the queue.');
        updateLiveQueue(message.guild);
    }

    if (commandName === 'queue-position') {
        const pos = db.getQueuePosition(message.author.id);
        if (pos) {
            message.reply(`Your current position is **#${pos}**.`);
        } else {
            message.reply('You are not in the queue.');
        }
    }

    if (commandName === 'remove') {
        if (!message.member.roles.cache.has(staffId) && !message.member.roles.cache.has(testerId) && !message.member.permissions.has('Administrator')) return;
        const target = message.mentions.members.first() || args[0];
        if (!target) return message.reply('Usage: `!remove <@user/ID>`');
        const targetId = target.id || target;
        db.removeFromQueue(targetId);
        message.reply(`✅ Removed <@${targetId}> from the queue.`);
        updateLiveQueue(message.guild);
    }

    if (commandName === 'ally-request') {
        const modal = new ModalBuilder().setCustomId('ally_request_modal').setTitle('Ally Role Request');
        // Note: You can't show a modal from a prefix command easily (only from an interaction), 
        // so we'll tell them to use the slash command or we trigger a button they can click.
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_ally_apply').setLabel('Apply for Ally').setStyle(ButtonStyle.Secondary)
        );
        message.channel.send({ content: 'Click the button below to open the Ally Application form.', components: [row] });
    }

    if (commandName === 'next') {
        if (!message.member.roles.cache.has(staffId) && !message.member.roles.cache.has(testerId) && !message.member.permissions.has('Administrator')) return;

        const channelName = message.channel.name;
        const channelKit = channelName.includes('-') ? channelName.split('-').pop().toUpperCase() : null;

        let q = db.getQueue();
        if (channelKit) {
            q = q.filter(u => u.category.toUpperCase() === channelKit);
        }

        if (q.length === 0) return message.reply(`The ${channelKit || ''} queue is empty.`);

        const nextUser = q[0];
        db.removeFromQueue(nextUser.user_id);

        // Auto-create ticket
        const userData = db.getUser(nextUser.user_id);
        const ign = userData ? userData.minecraft_ign : 'Unknown';
        const region = userData ? userData.region : 'Global';
        const accType = userData ? userData.account_type : 'Premium';
        const ticketCategoryId = getId('ticket_category', 'TICKET_CATEGORY_ID') || '1479077066258382989';

        try {
            const ticketChannel = await message.guild.channels.create({
                name: `test-${ign}-${nextUser.category}`,
                parent: ticketCategoryId,
                permissionOverwrites: [
                    { id: message.guild.id, deny: ['ViewChannel'] },
                    { id: nextUser.user_id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                    { id: message.author.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                    { id: staffId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] },
                    { id: testerId, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks'] }
                ]
            });

            const detailsEmbed = new EmbedBuilder()
                .setTitle('Player Information')
                .setColor('#2b2d31')
                .addFields(
                    { name: 'Minecraft IGN', value: `\`${ign}\``, inline: true },
                    { name: 'Region', value: `\`${region}\``, inline: true },
                    { name: 'Account Type', value: `\`${accType}\``, inline: true },
                    { name: 'Kit Category', value: `\`${nextUser.category}\``, inline: true }
                )
                .setFooter({ text: 'RearMC • Verification System' });

            const ticketEmbed = embeds.createBaseEmbed('Tier Test Session', `Ticket created for <@${nextUser.user_id}>'s **${nextUser.category}** test.\nTester: ${message.author}`);
            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${nextUser.user_id}> | ${message.author} | <@&${testerId}>`, embeds: [ticketEmbed, detailsEmbed], components: [closeRow] });

            // DM the player privately
            const player = await client.users.fetch(nextUser.user_id).catch(() => null);
            if (player) {
                player.send(`🔔 Your **${nextUser.category}** tier test ticket has been created! Head over to <#${ticketChannel.id}> to start your test with the tester.`).catch(() => { });
            }

            // No public announcement in the channel
        } catch (e) {
            console.error('Failed to create ticket on next cmd:', e);
        }

        updateLiveQueue(message.guild);
        if (nextUser.category) updateKitPanel(message.guild, nextUser.category);
    }

    if (commandName === 'queue') {
        const q = db.getQueue();
        if (q.length === 0) return message.reply('The queue is empty.');
        const list = q.map((u, i) => `**#${i + 1}** - <@${u.user_id}> (${u.category})`).join('\n');
        const embed = embeds.createBaseEmbed('Current Queue', list);
        message.channel.send({ embeds: [embed] });
    }

    if (commandName === 'give-tester' || commandName === 'add-tester' || commandName === 'tester') {
        if (!message.member.permissions.has('Administrator') && !message.member.roles.cache.has(staffId)) return;
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user to give the Tester role to. Usage: `!add-tester @user`');

        const testerRoleId = db.getSetting('tester_role');
        if (!testerRoleId) return message.reply('❌ Tester role not configured. Use `/setup role staff_role` and `/setup role tester_role` first.');

        try {
            await target.roles.add(testerRoleId);
            const embed = new EmbedBuilder()
                .setTitle('✅ Tester Access Granted')
                .setColor(0x2ecc71)
                .setDescription(
                    `Successfully granted **Tester** access to ${target}.\n\n` +
                    `**New Permissions:**\n` +
                    `• **Queues:** Can open/stop testing sessions via \`/tiertest\`\n` +
                    `• **Results:** Can post official game results via \`/result create\`\n` +
                    `• **Management:** Can call next players and remove from queue\n` +
                    `• **Access:** Full View/Send permissions in all waitlist channels`
                )
                .setFooter({ text: 'RearMC • System Management' });

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error adding tester role:', error);
            message.reply('❌ Failed to add the role. Please check my permissions.');
        }
    }

    if (commandName === 'registered') {
        if (!message.member.roles.cache.has(staffId) && !message.member.permissions.has('Administrator')) {
            return message.reply('Only Staff can use this command.');
        }

        const users = db.getAllTiers();
        if (users.length === 0) return message.reply('No players are currently registered.');

        const embedsList = [];
        let currentEmbed = new EmbedBuilder().setTitle('Registered Players & Tiers').setColor('#2b2d31').setTimestamp();
        let description = '';
        users.forEach((user, index) => {
            const tiersStr = user.tiers && user.tiers.length > 0 ? user.tiers.map(t => `${t.category}: ${t.tier}`).join(', ') : 'No Tiers';
            const line = `**${index + 1}.** <@${user.user_id}> (\`${user.minecraft_ign}\`)\nRegion: ${user.region} | Tiers: ${tiersStr}\n\n`;
            if ((description + line).length > 2000) {
                currentEmbed.setDescription(description);
                embedsList.push(currentEmbed);
                currentEmbed = new EmbedBuilder().setTitle('Registered Players (Continued)').setColor('#2b2d31');
                description = line;
            } else {
                description += line;
            }
        });
        currentEmbed.setDescription(description || 'No players found.');
        embedsList.push(currentEmbed);
        message.reply({ embeds: [embedsList[0]] });
        for (let i = 1; i < embedsList.length; i++) {
            message.channel.send({ embeds: [embedsList[i]] });
        }
    }

    if (commandName === 'sync-panels') {
        if (!message.member.permissions.has('Administrator')) return;
        const guild = message.guild;
        const kits = ['Nethpot', 'Sword', 'Axe', 'Diapot', 'UHC', 'SmpKit', 'Crystal', 'Mace'];
        let count = 0;
        for (const kit of kits) {
            await updateKitPanel(guild, kit);
            count++;
        }
        message.reply(`✅ Attempted to sync **${count}** kit panels.`);
    }
} catch (error) {
    console.error('[CRITICAL] Prefix handler error:', error);
}
});

// --- Automatic Sync Listener ---
// This watches for any result embeds in the designated channels and updates the DB
client.on(Events.MessageCreate, async message => {
    // Only look at messages in result channels (including those posted by this bot)
    const resultChannels = db.getResultChannels();
    const resultCmdChannel = getId('result_cmd_channel', 'RESULT_COMMAND_CHANNEL_ID');

    if (!resultChannels.includes(message.channelId) && message.channelId !== resultCmdChannel) return;
    if (message.embeds.length === 0) return;

    for (const embed of message.embeds) {
        const desc = embed.description;
        if (!desc) continue;

        try {
            const ignMatch = desc.match(/\*\*IGN:\*\*\n(.+)/);
            const userMatch = desc.match(/\*\*USER:\*\*\n<@!?(\d+)>/);
            const tierMatch = desc.match(/\*\*TIER EARNED:\*\*\n(.+)/);
            const categoryMatch = desc.match(/\*\*GAMEMODE:\*\*\n(.+)/);
            const regionMatch = desc.match(/\*\*REGION:\*\*\n(.+)/);

            if (ignMatch && userMatch && tierMatch && categoryMatch) {
                const userId = userMatch[1];
                const ign = ignMatch[1].trim();
                const tier = tierMatch[1].trim();
                const category = categoryMatch[1].trim();
                const region = regionMatch ? regionMatch[1].trim() : 'Global';

                db.updateUserTier(userId, ign, tier, category, region);
                console.log(`📡 Auto-Synced: ${ign} (${tier} in ${category} - ${region})`);
            }
        } catch (e) {
            // Not a syncable result format
        }
    }
});

// --- LIVE QUEUE SYSTEM ---
async function updateLiveQueue(guild) {
    const channelId = db.getSetting('queue_log_channel');
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const q = db.getQueue();
    const isOpen = db.isQueueOpen();

    let description = isOpen ? "🟢 **TESTING QUEUE IS OPEN**\n\n" : "🔴 **TESTING QUEUE IS CLOSED**\n\n";

    if (q.length === 0) {
        description += "_The queue is currently empty._";
    } else {
        description += q.map((u, i) => `**${i + 1}.** <@${u.user_id}> - \`${u.category}\``).join('\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 LIVE TESTING QUEUE')
        .setDescription(description)
        .setColor(isOpen ? 0x2ecc71 : 0xe74c3c)
        .setTimestamp()
        .setFooter({ text: 'RearMC • Real-time Updates' });

    const messageId = db.getSetting('queue_message_id');
    if (messageId) {
        try {
            const msg = await channel.messages.fetch(messageId);
            await msg.edit({ embeds: [embed] });
        } catch (e) {
            // Message deleted or not found, create new
            const newMsg = await channel.send({ embeds: [embed] });
            db.updateSetting('queue_message_id', newMsg.id);
        }
    } else {
        const newMsg = await channel.send({ embeds: [embed] });
        db.updateSetting('queue_message_id', newMsg.id);
    }
}

async function updateKitPanel(guild, kit) {
    const kitLower = kit.toLowerCase();
    const msgId = db.getSetting(`kit_msg_${kitLower}`);
    const channelId = db.getSetting(`kit_channel_${kitLower}`) || db.getWaitlistChannel(kit);

    if (!channelId) {
        console.log(`[DEBUG] Skipping kit panel update for ${kit}: No channel configured.`);
        return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const q = db.getQueue().filter(u => u.category.toUpperCase() === kit.toUpperCase());
    const testerId = db.getSetting(`kit_tester_${kitLower}`);
    const testers = testerId ? [testerId] : [];
    const isOpen = db.isQueueOpen() && db.getSetting(`kit_tester_${kitLower}`); // Ensure kit has a tester to be considered open for display

    const embed = isOpen ? embeds.kitQueueOpenEmbed(kit, q, testers) : embeds.kitQueueClosedEmbed(kit);

    try {
        if (msgId) {
            try {
                const msg = await channel.messages.fetch(msgId);
                await msg.edit({ embeds: [embed] });
                console.log(`[DEBUG] Updated ${kit} panel (Status: ${isOpen ? 'Open' : 'Closed'}).`);
            } catch (e) {
                if (e.code === 10008) {
                    // Unknown Message - clean stale ID and create new
                    console.log(`[DEBUG] Kit panel message for ${kit} was deleted. Creating new one.`);
                    const newMsg = await channel.send({ embeds: [embed] });
                    db.updateSetting(`kit_msg_${kitLower}`, newMsg.id);
                } else {
                    throw e;
                }
            }
        } else {
            // No msg ID exists, create new
            const newMsg = await channel.send({ embeds: [embed] });
            db.updateSetting(`kit_msg_${kitLower}`, newMsg.id);
            console.log(`[DEBUG] Created new ${kit} panel.`);
        }
    } catch (e) {
        console.error(`Failed to update kit panel for ${kit}:`, e);
    }
}

console.log('📡 Attempting to login to Discord...');
client.login(config.TOKEN).catch(err => {
    console.error('❌ Failed to login to Discord:', err);
    process.exit(1);
});

