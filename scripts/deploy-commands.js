const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./../utils/config');

const commands = [
    new SlashCommandBuilder().setName('open-queue').setDescription('Open the testing queue'),
    new SlashCommandBuilder().setName('close-queue').setDescription('Close the testing queue'),
    new SlashCommandBuilder().setName('apply-test').setDescription('Send the test application message'),
    new SlashCommandBuilder().setName('queue').setDescription('View the current queue'),
    new SlashCommandBuilder().setName('next').setDescription('Call the next player'),
    new SlashCommandBuilder().setName('tester-result').setDescription('View the tester leaderboard and statistics'),
    new SlashCommandBuilder().setName('result')
        .setDescription('Post a test result')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new test result')
                .addUserOption(opt => opt.setName('tester').setDescription('The Tester (Staff)').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('The Player (Discord)').setRequired(true))
                .addStringOption(opt => opt.setName('region').setDescription('Region (e.g. NA/EU)').setRequired(true))
                .addStringOption(opt => opt.setName('ign').setDescription('Minecraft IGN').setRequired(true))
                .addStringOption(opt => opt.setName('tier-earned').setDescription('Rank Earned').setRequired(true))
                .addStringOption(opt => opt.setName('gamemode').setDescription('Game Mode').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('repost')
                .setDescription('Re-post all results from the database to the results channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Specific channel to repost to (Optional)'))
        ),
    new SlashCommandBuilder().setName('tester')
        .setDescription('Manage tester roles')
        .addSubcommand(sub => sub.setName('add').setDescription('Add tester role').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove tester role').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true))),
    new SlashCommandBuilder().setName('setup')
        .setDescription('Configure bot settings (Admin only)')
        .addSubcommand(sub => sub.setName('role').setDescription('Configure roles')
            .addStringOption(opt => opt.setName('type').setDescription('Role type').setRequired(true).addChoices({ name: 'Staff', value: 'staff_role' }, { name: 'Tester', value: 'tester_role' }))
            .addRoleOption(opt => opt.setName('role').setDescription('The role').setRequired(true)))
        .addSubcommand(sub => sub.setName('channel').setDescription('Configure channels')
            .addStringOption(opt => opt.setName('type').setDescription('Channel type').setRequired(true).addChoices(
                { name: 'Requests', value: 'request_channel' },
                { name: 'Main Queue', value: 'queue_channel' },
                { name: 'Sword Queue', value: 'sword_channel' },
                { name: 'NethPot Queue', value: 'nethpot_channel' },
                { name: 'Logs', value: 'logs_channel' },
                { name: 'Ticket Category', value: 'ticket_category' },
                { name: 'Results Channel', value: 'results_channel' },
                { name: 'Result Command Channel', value: 'result_cmd_channel' },
                { name: 'Queue Log Channel', value: 'queue_log_channel' }
            ))
            .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(sub => sub.setName('bot').setDescription('Setup the evaluation panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('The channel to send the panel in').setRequired(true))),
    new SlashCommandBuilder().setName('embed')
        .setDescription('Manage embeds')
        .addSubcommand(sub => sub.setName('create')
            .setDescription('Create a custom embed')
            .addStringOption(opt => opt.setName('color').setDescription('Hex color (e.g. #FF0000)').setRequired(true))
            .addStringOption(opt => opt.setName('text').setDescription('The message text').setRequired(true))),
    new SlashCommandBuilder().setName('tierpermission')
        .setDescription('Manage tier permissions')
        .addSubcommand(sub => sub.setName('add')
            .setDescription('Add a tier permission')
            .addStringOption(opt => opt.setName('category').setDescription('The category').setRequired(true))
            .addStringOption(opt => opt.setName('result').setDescription('The result').setRequired(true))),
    new SlashCommandBuilder().setName('results-channel')
        .setDescription('Manage channels where test results are posted')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a channel to the results list')
                .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a channel from the results list')
                .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true))),
    new SlashCommandBuilder().setName('tiertest')
        .setDescription('Manage tier testing sessions')
        .addSubcommand(sub => sub.setName('start').setDescription('Start a tier testing session and open the queue'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Stop the tier testing session and close the queue')),
    new SlashCommandBuilder().setName('leave').setDescription('Leave the testing queue'),
    new SlashCommandBuilder().setName('position').setDescription('Check your position in the queue'),
    new SlashCommandBuilder().setName('waitlist-channel')
        .setDescription('Set a specific waitlist channel for a kit')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a waitlist channel')
                .addStringOption(opt => opt.setName('kit').setDescription('The kit name (e.g. UHC, Sword)').setRequired(true))
                .addChannelOption(opt => opt.setName('channel').setDescription('The channel to give access to').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Automatically create channels for all kits')),
    new SlashCommandBuilder().setName('waitlist-role')
        .setDescription('Set a specific waitlist role for a kit')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Link a kit to a role')
                .addStringOption(opt => opt.setName('kit').setDescription('The kit name (e.g. UHC, Sword)').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('The role to give').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Automatically create roles for all kits')),
    new SlashCommandBuilder().setName('autoroles')
        .setDescription('Automatic setup of all kit waitlist roles and channels')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Create and link all kit roles and channels')),
    new SlashCommandBuilder().setName('remove').setDescription('Remove a player from the queue (Staff Only)')
        .addUserOption(opt => opt.setName('user').setDescription('The user to remove').setRequired(true)),
    new SlashCommandBuilder().setName('lockwaitlists')
        .setDescription('Remove SendMessages from all players in waitlist channels (Admin only)'),
    new SlashCommandBuilder().setName('waitlist-tester')
        .setDescription('Manage tester access in waitlist channels')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Give a tester or role full access to all waitlist channels')
                .addUserOption(opt => opt.setName('user').setDescription('The tester to add (optional)'))
                .addRoleOption(opt => opt.setName('role').setDescription('The role to add (optional)')))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a tester or role\'s access from all waitlist channels')
                .addUserOption(opt => opt.setName('user').setDescription('The tester to remove (optional)'))
                .addRoleOption(opt => opt.setName('role').setDescription('The role to remove (optional)'))),
    new SlashCommandBuilder().setName('registered').setDescription('View a list of all registered players (Staff only)'),
    new SlashCommandBuilder().setName('remove-tier')
        .setDescription('Remove a specific kit tier from a player (Staff only)')
        .addUserOption(opt => opt.setName('user').setDescription('The Discord user').setRequired(true))
        .addStringOption(opt => opt.setName('gamemode').setDescription('The kit to remove (e.g. Nethpot, Sword)').setRequired(true)),
    new SlashCommandBuilder().setName('admin-sync').setDescription('Force sync the database to the website (Admin only)'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.TOKEN);

(async () => {
    try {
        console.log(`Started refreshing *instant* guild slash commands.`);
        await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
            { body: commands },
        );
        console.log(`Successfully reloaded *instant* guild slash commands.`);
    } catch (error) {
        console.error(error);
    }
})();
