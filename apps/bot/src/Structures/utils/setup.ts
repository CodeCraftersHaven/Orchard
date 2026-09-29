import type { PrismaClient } from '#utils';
import { channelUpdater, defaultWelcomeBackgroundUrl, economyLabels } from '#utils';
import { Sticky, stickyColors, type StickyContent } from './sticky.js';
import {
    ActionRowBuilder,
    BaseGuildTextChannel,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    PermissionsBitField,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    TextChannel,
    type ButtonInteraction,
    type ChannelSelectMenuInteraction,
    type ModalSubmitInteraction,
    type RoleSelectMenuInteraction,
    type StringSelectMenuInteraction,
} from 'discord.js';

export type SetupSystem = 'welcome' | 'birthdays' | 'community' | 'counting' | 'server-stats' | 'leveling' | 'reaction-roles' | 'verification' | 'economy' | 'stickies';
type SetupInteraction = ButtonInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction | RoleSelectMenuInteraction | StringSelectMenuInteraction;
const positions = ['left', 'middle', 'right'] as const;

type StickySetupDraft = StickyContent & { stickyId?: string };
type SetupDeps = { prisma: PrismaClient; sticky: Sticky };
const stickySetupDrafts = new Map<string, StickySetupDraft>();

function stickyDraftKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}

function newStickyDraft(): StickySetupDraft {
    return { channelId: '', mode: 'Text', content: '', title: '', description: '', color: '#5865F2' };
}

const textChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;
const introChannelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.AnnouncementThread,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
] as const;

function stickyDraftFor(guildId: string, userId: string) {
    const key = stickyDraftKey(guildId, userId);
    let draft = stickySetupDrafts.get(key);
    if (!draft) {
        draft = newStickyDraft();
        stickySetupDrafts.set(key, draft);
    }
    return draft;
}

function isAdministrator(interaction: SetupInteraction) {
    return interaction.inGuild() && (interaction.member?.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator);
}

function systemSelector(selected?: SetupSystem) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('setup-system').setPlaceholder('Choose a system to manage').addOptions([
            { label: 'Welcome messages', value: 'welcome', description: 'Configure welcome images and messages.', default: selected === 'welcome' },
            { label: 'Birthday messages', value: 'birthdays', description: 'Enable or disable birthday announcements.', default: selected === 'birthdays' },
            { label: 'Community channels', value: 'community', description: 'Configure shared community channel assignments.', default: selected === 'community' },
            { label: 'Counting', value: 'counting', description: 'Configure the counting channel and state.', default: selected === 'counting' },
            { label: 'Server stats', value: 'server-stats', description: 'Configure visible voice-channel member statistics.', default: selected === 'server-stats' },
            { label: 'Leveling', value: 'leveling', description: 'Configure weekly XP rewards.', default: selected === 'leveling' },
            { label: 'Reaction roles', value: 'reaction-roles', description: 'Manage reaction-role panels.', default: selected === 'reaction-roles' },
            { label: 'Verification', value: 'verification', description: 'Create a reaction-based member verification panel.', default: selected === 'verification' },
            { label: 'Economy', value: 'economy', description: 'Customize currency and bank settings.', default: selected === 'economy' },
            { label: 'Sticky messages', value: 'stickies', description: 'Create and manage per-channel sticky messages.', default: selected === 'stickies' },
        ])
    );
}

function overviewButton() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('setup-overview').setLabel('Setup overview').setStyle(ButtonStyle.Secondary)
    );
}

const systemLabels: Record<SetupSystem, string> = {
    welcome: 'Welcome messages',
    birthdays: 'Birthday messages',
    community: 'Community channels',
    counting: 'Counting',
    'server-stats': 'Server stats',
    leveling: 'Leveling',
    'reaction-roles': 'Reaction roles',
    verification: 'Verification',
    economy: 'Economy',
    stickies: 'Sticky messages',
};

type SystemDefinition = {
    enable: (prisma: PrismaClient, guildId: string) => Promise<void>;
    disable: (prisma: PrismaClient, guildId: string) => Promise<void>;
    setChannel?: (prisma: PrismaClient, guildId: string, channelId: string) => Promise<void>;
};

const systemDefinitions: Record<SetupSystem, SystemDefinition> = {
    welcome: {
        enable: async (prisma, guildId) => { await prisma.welcomeSettings.upsert({ where: { gID: guildId }, update: { enabled: true }, create: { gID: guildId, enabled: true } }); },
        disable: async (prisma, guildId) => { await prisma.welcomeSettings.deleteMany({ where: { gID: guildId } }); },
        setChannel: async (prisma, guildId, channelId) => { await prisma.welcomeSettings.upsert({ where: { gID: guildId }, update: { channelId }, create: { gID: guildId, channelId } }); },
    },
    birthdays: {
        enable: async (prisma, guildId) => { await prisma.birthday.upsert({ where: { gID: guildId }, update: { settings: { update: { enabled: true } } }, create: { gID: guildId, settings: { create: { gID: guildId, enabled: true } } } }); },
        disable: async (prisma, guildId) => {
            await prisma.$transaction(async transaction => {
                await transaction.birthdaySubscription.deleteMany({ where: { gID: guildId } });
                const birthday = await transaction.birthday.findUnique({ where: { gID: guildId }, select: { settingsId: true } });
                if (birthday) {
                    await transaction.birthday.delete({ where: { gID: guildId } });
                    await transaction.birthdaySettings.delete({ where: { gID: birthday.settingsId } });
                }
            });
        },
    },
    community: {
        enable: async () => { },
        disable: async (prisma, guildId) => {
            await prisma.guild.updateMany({ where: { gID: guildId }, data: { introC: '', announcementsChannelId: '', taskLogsChannelId: '', gamingChannelId: '', modC: '', leaveChannelId: '', leaveEnabled: false } });
        },
    },
    counting: {
        enable: async (prisma, guildId) => { await prisma.counter.upsert({ where: { gID: guildId }, update: { active: true }, create: { gID: guildId, channel: '', active: true, count: 0, highestCount: 0 } }); },
        disable: async (prisma, guildId) => {
            await prisma.$transaction([
                prisma.countingUser.deleteMany({ where: { counterId: guildId } }),
                prisma.counter.deleteMany({ where: { gID: guildId } }),
            ]);
        },
        setChannel: async (prisma, guildId, channelId) => { await prisma.counter.upsert({ where: { gID: guildId }, update: { channel: channelId }, create: { gID: guildId, channel: channelId, active: false, count: 0, highestCount: 0 } }); },
    },
    'server-stats': {
        enable: async () => { },
        disable: async (prisma, guildId) => { await prisma.serverStats.deleteMany({ where: { gID: guildId } }); },
    },
    leveling: {
        enable: async (prisma, guildId) => { await prisma.levelSettings.upsert({ where: { gID: guildId }, update: { enabled: true }, create: { gID: guildId, enabled: true } }); },
        disable: async (prisma, guildId) => { await prisma.levelSettings.deleteMany({ where: { gID: guildId } }); },
        setChannel: async (prisma, guildId, channelId) => { await prisma.levelSettings.upsert({ where: { gID: guildId }, update: { channel: channelId }, create: { gID: guildId, channel: channelId, enabled: true } }); },
    },
    'reaction-roles': {
        enable: async () => { },
        disable: async (prisma, guildId) => { await prisma.reactionRole.deleteMany({ where: { gID: guildId } }); },
    },
    verification: {
        enable: async () => { },
        disable: async (prisma, guildId) => {
            await prisma.guild.updateMany({ where: { gID: guildId }, data: { verifiedRole: '', nonVerifiedRoleId: '', reactionMessageId: '' } });
        },
    },
    economy: {
        enable: async () => { },
        disable: async (prisma, guildId) => {
            await prisma.$transaction([
                prisma.economyListing.deleteMany({ where: { serverId: guildId } }),
                prisma.economyItemDefinition.deleteMany({ where: { serverId: guildId } }),
                prisma.economyFarmPlot.deleteMany({ where: { serverId: guildId } }),
                prisma.economyCraftJob.deleteMany({ where: { serverId: guildId } }),
                prisma.economyBoost.deleteMany({ where: { serverId: guildId } }),
                prisma.economyGameSession.deleteMany({ where: { serverId: guildId } }),
                prisma.economySettings.deleteMany({ where: { gID: guildId } }),
            ]);
        },
    },
    stickies: {
        enable: async (prisma, guildId) => {
            await prisma.stickySettings.upsert({ where: { guildId }, update: { enabled: true }, create: { guildId, enabled: true } });
        },
        disable: async (prisma, guildId) => { await prisma.stickySettings.deleteMany({ where: { guildId } }); },
    },
};

function isSetupSystem(value: string): value is SetupSystem {
    return value in systemDefinitions;
}

function setupPanelId(guildId: string, system: SetupSystem) {
    return `${guildId}-${system}`;
}

async function setupPanel(prisma: PrismaClient, guildId: string, system: SetupSystem) {
    return prisma.systemSetupPanel.findUnique({ where: { gID_system: { gID: guildId, system } } });
}

function enablePanelModal(system: SetupSystem) {
    const note = new LabelBuilder()
        .setLabel('@users note')
        .setDescription('Optional information for members about this channel.')
        .setTextInputComponent(new TextInputBuilder()
            .setCustomId('setup-note')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Tell members what this channel is for.'));
    return new ModalBuilder()
        .setCustomId(`setup-enable-submit/${system}`)
        .setTitle(`Enable ${systemLabels[system]}`)
        .addLabelComponents(note);
}

function economyModal() {
    const field = (id: string, label: string, placeholder: string, value = '') => new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setRequired(false).setValue(value).setPlaceholder(placeholder));
    return new ModalBuilder().setCustomId('setup-economy-submit').setTitle('Economy settings').addLabelComponents(
        field('currency-name', 'Currency name', 'Coins'),
        field('bank-name', 'Bank name', 'Bank'),
        field('currency-image', 'Currency image URL', 'https://example.com/currency.png'),
        field('bank-image', 'Bank image URL', 'https://example.com/bank.png'),
    );
}

function stickyContentModal(draft: StickySetupDraft) {
    const isEmbed = draft.mode === 'Embed';
    const label = isEmbed ? 'Embed description' : draft.mode === 'Container' ? 'Container text' : 'Message text';
    const content = isEmbed ? draft.description : draft.content;
    return new ModalBuilder().setCustomId('setup-sticky-content-submit').setTitle(label).addLabelComponents(
        new LabelBuilder().setLabel(label).setTextInputComponent(
            new TextInputBuilder().setCustomId('sticky-body').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(isEmbed || draft.mode === 'Container' ? 4000 : 2000).setValue(content).setPlaceholder(label)
        )
    );
}

function serverStatsModal() {
    const field = (id: string, label: string, placeholder: string) => new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder(placeholder));
    return new ModalBuilder().setCustomId('setup-server-stats-create').setTitle('Create server stats channels').addLabelComponents(
        field('all-name', 'Total Members channel', 'Total Members'),
        field('users-name', 'Users channel', 'Users'),
        field('bots-name', 'Bots channel', 'Bots'),
    );
}

function levelingModal(settings: { firstReward: number; secondReward: number; thirdReward: number; participantReward: number }) {
    const field = (id: string, label: string, value: number) => new LabelBuilder().setLabel(label).setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setRequired(true).setValue(String(value)));
    return new ModalBuilder().setCustomId('setup-leveling-rewards').setTitle('Weekly XP rewards').addLabelComponents(
        field('first-reward', '1st place coins', settings.firstReward), field('second-reward', '2nd place coins', settings.secondReward), field('third-reward', '3rd place coins', settings.thirdReward), field('participant-reward', 'Top 10 participation coins', settings.participantReward),
    );
}

function welcomeContentModal(settings: { embedTitle?: string; embedDescription?: string; embedColor?: string }) {
    const field = (id: string, label: string, placeholder: string, value = '', style = TextInputStyle.Short) => new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(false).setValue(value).setPlaceholder(placeholder));
    return new ModalBuilder().setCustomId('setup-welcome-content').setTitle('Welcome content').addLabelComponents(
        field('welcome-message', 'Regular message', 'Welcome to {guild}, {member}'),
        field('embed-title', 'Embed title', 'Welcome!', settings.embedTitle ?? ''),
        field('embed-description', 'Embed description', 'Welcome to {guild}, {member}', settings.embedDescription ?? '', TextInputStyle.Paragraph),
        field('embed-color', 'Embed color', '#5865F2', settings.embedColor ?? '#5865F2'),
    );
}

async function configureStatsChannel(interaction: ChannelSelectMenuInteraction, prisma: PrismaClient, field: 'allCountChan' | 'userCountChan' | 'botCountChan') {
    const current = await prisma.serverStats.findUnique({ where: { gID: interaction.guildId! } });
    const guildSettings = await prisma.guild.findUnique({ where: { gID: interaction.guildId! } });
    const channel = interaction.guild?.channels.cache.get(interaction.values[0]);
    if (channel?.isVoiceBased()) {
        await channel.permissionOverwrites.set([
            { id: interaction.guildId!, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] },
            ...(guildSettings?.nonVerifiedRoleId ? [{ id: guildSettings.nonVerifiedRoleId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }] : []),
            ...(guildSettings?.verifiedRole ? [{ id: guildSettings.verifiedRole, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] }] : []),
        ]);
    }
    await prisma.serverStats.upsert({
        where: { gID: interaction.guildId! },
        update: { [field]: interaction.values[0] },
        create: { gID: interaction.guildId!, [field]: interaction.values[0] },
    });
    await channelUpdater(interaction.guild!);
    return interaction.update({ components: [await buildSetupContainer('server-stats', interaction.guildId!, prisma)], flags: MessageFlags.IsComponentsV2 });
}

async function createServerStatsChannels(interaction: ModalSubmitInteraction, prisma: PrismaClient) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'The server could not be loaded.', flags: MessageFlags.Ephemeral });
    const guildSettings = await prisma.guild.findUnique({ where: { gID: guild.id } });
    const names = {
        all: interaction.fields.getTextInputValue('all-name').trim() || 'Total Members',
        users: interaction.fields.getTextInputValue('users-name').trim() || 'Users',
        bots: interaction.fields.getTextInputValue('bots-name').trim() || 'Bots',
    };
    const existing = await prisma.serverStats.findUnique({ where: { gID: guild.id } });
    const permissionOverwrites = [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] },
        ...(guildSettings?.nonVerifiedRoleId ? [{ id: guildSettings.nonVerifiedRoleId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }] : []),
        ...(guildSettings?.verifiedRole ? [{ id: guildSettings.verifiedRole, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] }] : []),
    ];
    const category = existing?.categoryId
        ? guild.channels.cache.get(existing.categoryId)
        : guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'server stats');
    const statsCategory = category?.type === ChannelType.GuildCategory
        ? category
        : await guild.channels.create({ name: 'server stats', type: ChannelType.GuildCategory, permissionOverwrites });
    await statsCategory.setPosition(0);
    const create = async (channelId: string, name: string) => {
        if (channelId) return channelId;
        const channel = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: statsCategory.id, permissionOverwrites });
        return channel.id;
    };
    const [allCountChan, userCountChan, botCountChan] = await Promise.all([
        create(existing?.allCountChan ?? '', 'Total Members: 0'),
        create(existing?.userCountChan ?? '', 'Users: 0'),
        create(existing?.botCountChan ?? '', 'Bots: 0'),
    ]);
    await Promise.all([allCountChan, userCountChan, botCountChan].map(async channelId => {
        const channel = guild.channels.cache.get(channelId);
        if (channel?.isVoiceBased()) await channel.setParent(statsCategory.id);
    }));
    await prisma.serverStats.upsert({
        where: { gID: guild.id },
        update: { allCountChan, userCountChan, botCountChan, categoryId: statsCategory.id },
        create: { gID: guild.id, allCountChan, userCountChan, botCountChan, categoryId: statsCategory.id, allCount: 0, userCount: 0, botCount: 0 },
    });
    await channelUpdater(guild);
    return interaction.reply({ content: 'Server stats channels are configured. Members can view them but cannot connect.', flags: MessageFlags.Ephemeral });
}

async function saveSetupChannel(prisma: PrismaClient, guildId: string, system: SetupSystem, channelId: string) {
    return prisma.systemSetupPanel.upsert({
        where: { gID_system: { gID: guildId, system } },
        update: { channelId },
        create: { id: setupPanelId(guildId, system), gID: guildId, system, channelId, messageId: '' },
    });
}

async function deleteSetupPanel(interaction: SetupInteraction, system: SetupSystem, prisma: PrismaClient) {
    const panel = await setupPanel(prisma, interaction.guildId!, system);
    if (!panel) return;
    if (panel.messageId) {
        const channel = await interaction.guild?.channels.fetch(panel.channelId).catch(() => null);
        if (channel instanceof BaseGuildTextChannel) await channel.messages.delete(panel.messageId).catch(() => undefined);
    }
    await prisma.systemSetupPanel.delete({ where: { gID_system: { gID: interaction.guildId!, system } } });
}

async function disableSystem(interaction: SetupInteraction, system: SetupSystem, prisma: PrismaClient, stickyService: Sticky) {
    await deleteSetupPanel(interaction, system, prisma);
    if (system === 'stickies') {
        const stickies = await stickyService.list(interaction.guildId!);
        await Promise.all(stickies.map(sticky => stickyService.delete(interaction.guildId!, sticky.id)));
    }
    await systemDefinitions[system].disable(prisma, interaction.guildId!);
}

async function postSystemPanel(interaction: ModalSubmitInteraction, system: SetupSystem, prisma: PrismaClient) {
    const panel = await setupPanel(prisma, interaction.guildId!, system);
    const channel = interaction.guild?.channels.cache.get(panel?.channelId ?? '');
    if (!(channel instanceof BaseGuildTextChannel)) {
        await interaction.reply({ content: `Choose a channel for ${systemLabels[system]} before enabling the system.`, flags: MessageFlags.Ephemeral });
        return;
    }
    if (panel?.messageId) {
        await interaction.reply({ content: `${systemLabels[system]} is already enabled in <#${panel.channelId}>.`, flags: MessageFlags.Ephemeral });
        return;
    }
    const note = interaction.fields.getTextInputValue('setup-note').trim();
    const embed = new EmbedBuilder()
        .setTitle(`${systemLabels[system]} enabled`)
        .setDescription(`The ${systemLabels[system]} system has been enabled for <#${channel.id}>.`)
        .setColor(0x57f287);
    if (note) embed.addFields({ name: `${interaction.user.toString()}**'s** note`, value: note });
    const message = await channel.send({ embeds: [embed] });
    await prisma.systemSetupPanel.upsert({
        where: { gID_system: { gID: interaction.guildId!, system } },
        update: { messageId: message.id, note },
        create: { id: setupPanelId(interaction.guildId!, system), gID: interaction.guildId!, system, channelId: channel.id, messageId: message.id, note },
    });
    await interaction.reply({ content: `${systemLabels[system]} enabled in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
}

async function createVerificationPanel(interaction: ButtonInteraction, prisma: PrismaClient) {
    const guild = interaction.guild;
    if (!guild) return;
    const settings = await prisma.guild.findUnique({ where: { gID: guild.id } });
    const panel = await setupPanel(prisma, guild.id, 'verification');
    const channel = guild.channels.cache.get(panel?.channelId ?? '');
    if (!(channel instanceof BaseGuildTextChannel)) return interaction.reply({ content: 'Choose a verification channel first.', flags: MessageFlags.Ephemeral });
    if (!settings?.verifiedRole || !settings.nonVerifiedRoleId) return interaction.reply({ content: 'Choose both verified and non-verified roles first.', flags: MessageFlags.Ephemeral });
    if (panel?.messageId) return interaction.reply({ content: `The verification panel is already posted in <#${panel.channelId}>.`, flags: MessageFlags.Ephemeral });
    const message = await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('Member verification')
            .setDescription('React with any emoji to verify and unlock the server.')
            .setColor(0x57f287)]
    });
    await message.react('✅');
    await prisma.$transaction([
        prisma.guild.update({ where: { gID: guild.id }, data: { reactionMessageId: message.id } }),
        prisma.systemSetupPanel.upsert({
            where: { gID_system: { gID: guild.id, system: 'verification' } },
            update: { messageId: message.id },
            create: { id: setupPanelId(guild.id, 'verification'), gID: guild.id, system: 'verification', channelId: channel.id, messageId: message.id },
        }),
    ]);
    return interaction.update({ components: [await buildSetupContainer('verification', guild.id, prisma)], flags: MessageFlags.IsComponentsV2 });
}

export function buildSetupOverview() {
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Pomona setup\nChoose a system below to manage it. You can switch systems at any time.'))
        .addActionRowComponents(systemSelector());
}

export async function buildSetupContainer(system: SetupSystem, guildId: string, prisma: PrismaClient, userId?: string) {
    const container = new ContainerBuilder().addActionRowComponents(systemSelector(system));
    if (system === 'welcome') {
        const settings = await prisma.welcomeSettings.upsert({ where: { gID: guildId }, update: {}, create: { gID: guildId } });
        const content = await prisma.botWelcomeMessages.findUnique({ where: { gID: guildId } });
        const panel = await setupPanel(prisma, guildId, system);
        const position = positions.includes(settings.avatarPosition as typeof positions[number]) ? settings.avatarPosition : 'middle';
        const background = settings.backgroundUrl ? `Current background: ${settings.backgroundUrl}` : 'Current background: Pomona default';
        const channelId = panel?.channelId || settings.channelId;
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Welcome messages\nChoose a regular message, embed, or image welcome, then preview and edit its content before enabling it.\n\nFormat: **${settings.mode === 'text' ? 'Regular message' : settings.mode === 'embed' ? 'Embed' : 'Image welcome'}**\nPreview: **${content?.messagesArray[0] || settings.embedTitle || 'Default welcome'}**\nCurrent position: **${position}**\n${background}\n\nPanel: **${panel?.messageId ? `Enabled in <#${channelId}>` : 'Not posted'}**`))
            .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId('setup-welcome-mode').setPlaceholder('Choose welcome format').addOptions([
                { label: 'Regular message', value: 'text', default: settings.mode === 'text' },
                { label: 'Embed', value: 'embed', default: settings.mode === 'embed' },
                { label: 'Image welcome', value: 'image', default: settings.mode !== 'text' && settings.mode !== 'embed' && settings.mode !== 'container' },
                { label: 'Editable container', value: 'container', default: settings.mode === 'container' },
            ])))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-welcome-content').setLabel('Edit welcome content').setStyle(ButtonStyle.Primary)))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...positions.map(value => new ButtonBuilder().setCustomId(`setup-welcome-avatar/${value}`).setLabel(value[0].toUpperCase() + value.slice(1)).setStyle(value === position ? ButtonStyle.Success : ButtonStyle.Secondary))))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-welcome-background').setLabel('Change background').setStyle(ButtonStyle.Primary)))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-channel/welcome').setPlaceholder('Choose welcome channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(channelId ? [channelId] : [])))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-enable/welcome').setLabel(panel?.messageId ? 'Panel already posted' : 'Enable and post panel').setStyle(panel?.messageId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(Boolean(panel?.messageId))))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/welcome').setLabel('Disable system').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'birthdays') {
        const birthday = await prisma.birthday.findUnique({ where: { gID: guildId }, include: { settings: true } });
        const enabled = birthday?.settings.enabled ?? false;
        const announceChannelId = birthday?.settings.announceChannelId ?? '';
        const logChannelId = birthday?.settings.logChannelId ?? '';
        const panel = await setupPanel(prisma, guildId, system);
        const panelChannelId = panel?.channelId || announceChannelId;
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Birthday messages\nBirthday announcements are currently **${enabled ? 'enabled' : 'disabled'}**.\n\nAnnouncement channel: **${announceChannelId ? `<#${announceChannelId}>` : 'Not configured'}**\nLog channel: **${logChannelId ? `<#${logChannelId}>` : 'Not configured'}**\nPanel: **${panel?.messageId ? `Enabled in <#${panelChannelId}>` : 'Not posted'}**`))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('setup-enable/birthdays').setLabel(panel?.messageId ? 'Panel already posted' : 'Enable and post panel').setStyle(panel?.messageId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(Boolean(panel?.messageId)),
                new ButtonBuilder().setCustomId('setup-disable/birthdays').setLabel('Disable').setStyle(!enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-birthday-announcement-channel').setPlaceholder('Choose announcement channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(announceChannelId ? [announceChannelId] : [])
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-birthday-log-channel').setPlaceholder('Choose log channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(logChannelId ? [logChannelId] : [])
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-channel/birthdays').setPlaceholder('Choose panel channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(panelChannelId ? [panelChannelId] : [])
            ))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'community') {
        const guild = await prisma.guild.findUnique({ where: { gID: guildId } });
        const fields = [
            { key: 'introC', label: 'Introductions', channelId: guild?.introC ?? '', types: introChannelTypes },
            { key: 'announcementsChannelId', label: 'Announcements', channelId: guild?.announcementsChannelId ?? '', types: textChannelTypes },
            { key: 'taskLogsChannelId', label: 'Task logs', channelId: guild?.taskLogsChannelId ?? '', types: textChannelTypes },
            { key: 'gamingChannelId', label: 'Gaming', channelId: guild?.gamingChannelId ?? '', types: textChannelTypes },
            { key: 'modC', label: 'Moderation', channelId: guild?.modC ?? '', types: textChannelTypes },
            { key: 'leaveChannelId', label: 'Leave messages', channelId: guild?.leaveChannelId ?? '', types: textChannelTypes },
        ];
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Community channels\nConfigure the same shared channel assignments used by the dashboard.\n\n${fields.map(field => `${field.label}: **${field.channelId ? `<#${field.channelId}>` : 'Not configured'}**`).join('\n')}`));
        for (const field of fields) {
            container.addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId(`setup-community/${field.key}`)
                    .setPlaceholder(`Choose ${field.label.toLowerCase()} channel`)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .setChannelTypes(...field.types)
                    .setDefaultChannels(field.channelId ? [field.channelId] : [])
            ));
        }
        return container
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/community').setLabel('Clear community channel settings').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'counting') {
        const counter = await prisma.counter.findUnique({ where: { gID: guildId } });
        const enabled = counter?.active ?? false;
        const panel = await setupPanel(prisma, guildId, system);
        const channelId = panel?.channelId || counter?.channel || '';
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Counting\nCounting is currently **${enabled ? 'enabled' : 'disabled'}**.\n\nChannel: **${channelId ? `<#${channelId}>` : 'Not configured'}**\nCurrent count: **${counter?.count ?? 0}**\nHighest count: **${counter?.highestCount ?? 0}**`))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('setup-enable/counting').setLabel(panel?.messageId ? 'Panel already posted' : 'Enable and post panel').setStyle(panel?.messageId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(Boolean(panel?.messageId)),
                new ButtonBuilder().setCustomId('setup-disable/counting').setLabel('Disable').setStyle(!enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-channel/counting').setPlaceholder('Choose counting channel').setChannelTypes(ChannelType.GuildText).setDefaultChannels(channelId ? [channelId] : [])
            ))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'server-stats') {
        const stats = await prisma.serverStats.findUnique({ where: { gID: guildId } });
        const guild = await prisma.guild.findUnique({ where: { gID: guildId } });
        const voiceChannel = (id: string) => id ? `<#${id}>` : 'Not configured';
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Server stats
Members can see these voice channels but cannot connect. Non-verified members cannot see them.

Total Members: **${voiceChannel(stats?.allCountChan ?? '')}**
Users: **${voiceChannel(stats?.userCountChan ?? '')}**
Bots: **${voiceChannel(stats?.botCountChan ?? '')}**

Verified role: **${guild?.verifiedRole ? `<@&${guild.verifiedRole}>` : 'Not configured'}**
Non-verified role: **${guild?.nonVerifiedRoleId ? `<@&${guild.nonVerifiedRoleId}>` : 'Not configured'}**`))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-stats/all').setPlaceholder('Use an existing Total Members voice channel').setChannelTypes(ChannelType.GuildVoice).setDefaultChannels(stats?.allCountChan ? [stats.allCountChan] : [])))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-stats/users').setPlaceholder('Use an existing Users voice channel').setChannelTypes(ChannelType.GuildVoice).setDefaultChannels(stats?.userCountChan ? [stats.userCountChan] : [])))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-stats/bots').setPlaceholder('Use an existing Bots voice channel').setChannelTypes(ChannelType.GuildVoice).setDefaultChannels(stats?.botCountChan ? [stats.botCountChan] : [])))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-stats-create').setLabel('Create missing channels').setStyle(ButtonStyle.Primary)))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/server-stats').setLabel('Disable and remove stats').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'stickies') {
        const settings = await prisma.stickySettings.findUnique({ where: { guildId }, include: { stickies: { orderBy: { id: 'asc' } } } });
        const stickies = settings?.stickies ?? [];
        const draft = userId ? stickySetupDrafts.get(stickyDraftKey(guildId, userId)) ?? newStickyDraft() : newStickyDraft();
        const body = draft.mode === 'Embed' ? draft.description : draft.content;
        const stickyOptions = stickies.length
            ? stickies.slice(0, 25).map(sticky => ({ label: `${sticky.mode} - #${sticky.channelId}`.slice(0, 100), value: sticky.id, description: sticky.id }))
            : [{ label: 'No sticky messages configured', value: 'none' }];
        container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Sticky messages\nStatus: **${settings?.enabled ? 'Enabled' : 'Paused'}**\nLog channel: **${settings?.logsChannelId ? `<#${settings.logsChannelId}>` : 'Not configured'}**\n\n${stickies.length ? stickies.slice(0, 15).map(sticky => `**${sticky.mode}** in <#${sticky.channelId}>`).join('\n') : 'No sticky messages configured.'}${stickies.length > 15 ? '\n…and more. Select a sticky below to edit or delete it.' : ''}`))
            .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId('setup-sticky-select').setPlaceholder('Choose a sticky to edit or delete').addOptions(stickyOptions)
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-sticky-channel').setPlaceholder('Choose sticky channel').setMinValues(1).setMaxValues(1).setChannelTypes(...textChannelTypes).setDefaultChannels(draft.channelId ? [draft.channelId] : [])
            ))
            .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId('setup-sticky-mode').setPlaceholder('Choose sticky format').addOptions([
                    { label: 'Regular message', value: 'Text', default: draft.mode === 'Text' },
                    { label: 'Embed', value: 'Embed', default: draft.mode === 'Embed' },
                    { label: 'Container', value: 'Container', default: draft.mode === 'Container' },
                ])
            ))
            .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId('setup-sticky-color').setPlaceholder('Choose sticky color').addOptions(stickyColors.map(color => ({ label: color.name, value: color.value, default: draft.color === color.value })))
            ))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('setup-sticky-log-channel').setPlaceholder('Choose startup log channel').setMinValues(0).setMaxValues(1).setChannelTypes(...textChannelTypes).setDefaultChannels(settings?.logsChannelId ? [settings.logsChannelId] : [])
            ))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('setup-sticky-content').setLabel(draft.mode === 'Embed' ? 'Set embed description' : draft.mode === 'Container' ? 'Set container content' : 'Set message content').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup-sticky-new').setLabel('New sticky').setStyle(ButtonStyle.Secondary),
            ))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('setup-sticky-create').setLabel('Create sticky').setStyle(ButtonStyle.Success).setDisabled(Boolean(draft.stickyId) || !settings?.logsChannelId || !draft.channelId),
                new ButtonBuilder().setCustomId('setup-sticky-update').setLabel('Save changes').setStyle(ButtonStyle.Primary).setDisabled(!draft.stickyId),
                new ButtonBuilder().setCustomId('setup-sticky-delete').setLabel('Delete selected').setStyle(ButtonStyle.Danger).setDisabled(!draft.stickyId),
            ))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('setup-sticky-toggle').setLabel(settings?.enabled ? 'Pause stickies' : 'Enable stickies').setStyle(settings?.enabled ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(!settings?.enabled && !settings?.logsChannelId),
            ))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/stickies').setLabel('Delete all sticky messages').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
        return container;
    }
    if (system === 'leveling') {
        const settings = await prisma.levelSettings.upsert({ where: { gID: guildId }, update: {}, create: { gID: guildId } });
        const { currencyName } = await economyLabels(prisma, guildId);
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Leveling\nWeekly XP leaderboard is **${settings.enabled ? 'enabled' : 'disabled'}**.\nLevel UpChannel: **${settings.channel ? `<#${settings.channel}>` : 'Not configured'}**\n\n🥇 ${settings.firstReward} XP\n🥈 ${settings.secondReward} XP\n🥉 ${settings.thirdReward} XP\nTop 10 participation: ${settings.participantReward} ${currencyName}`))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-leveling-channel').setPlaceholder('Choose level up channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(settings.channel ? [settings.channel] : [])))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-leveling-rewards').setLabel('Edit weekly rewards').setStyle(ButtonStyle.Primary)))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-enable/leveling').setLabel(settings.enabled ? 'Enabled' : 'Enable leveling').setStyle(settings.enabled ? ButtonStyle.Secondary : ButtonStyle.Success)))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/leveling').setLabel('Disable and remove leveling').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'verification') {
        const guild = await prisma.guild.findUnique({ where: { gID: guildId } });
        const panel = await setupPanel(prisma, guildId, system);
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Verification\n${panel?.messageId ? `Panel: **Enabled in <#${panel.channelId}>**` : 'Panel: **Not posted**'}\n\nVerified role: **${guild?.verifiedRole ? `<@&${guild.verifiedRole}>` : 'Not configured'}**\nNon-verified role: **${guild?.nonVerifiedRoleId ? `<@&${guild.nonVerifiedRoleId}>` : 'Not configured'}**\nIntro channel: **${guild?.introC ? `<#${guild.introC}>` : 'Not configured'}**\nRoles channel: **${guild?.rolesChannelId ? `<#${guild.rolesChannelId}>` : 'Not configured'}**`))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-channel/verification').setPlaceholder('Choose verification channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(panel?.channelId ? [panel.channelId] : [])))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-verification-intro').setPlaceholder('Choose intro channel').setChannelTypes(...introChannelTypes).setDefaultChannels(guild?.introC ? [guild.introC] : [])))
            .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-verification-roles').setPlaceholder('Choose roles channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(guild?.rolesChannelId ? [guild.rolesChannelId] : [])))
            .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId('setup-verification-verified-role').setPlaceholder('Choose verified role').setMinValues(1).setMaxValues(1).setDefaultRoles(guild?.verifiedRole ? [guild.verifiedRole] : [])))
            .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId('setup-verification-nonverified-role').setPlaceholder('Choose non-verified role').setMinValues(1).setMaxValues(1).setDefaultRoles(guild?.nonVerifiedRoleId ? [guild.nonVerifiedRoleId] : [])))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-verification-create').setLabel(panel?.messageId ? 'Panel already posted' : 'Create verification panel').setStyle(panel?.messageId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(Boolean(panel?.messageId))))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/verification').setLabel('Disable verification').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    if (system === 'economy') {
        const settings = await prisma.economySettings.findUnique({ where: { gID: guildId } });
        return container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Economy\nCurrency: **${settings?.currencyName ?? 'Coins'}**\nBank: **${settings?.bankName ?? 'Bank'}**\n\nUse the button below to customize names and optional images.`))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-economy-edit').setLabel('Edit economy settings').setStyle(ButtonStyle.Primary)))
            .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/economy').setLabel('Disable and remove economy').setStyle(ButtonStyle.Danger)))
            .addActionRowComponents(overviewButton());
    }
    const panels = await prisma.reactionRole.findMany({ where: { gID: guildId }, orderBy: { id: 'asc' } });
    const setupPanelRecord = await setupPanel(prisma, guildId, system);
    const panelChannelId = setupPanelRecord?.channelId ?? '';
    return container
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Reaction roles\nManage multi-role reaction panels from this system.\n\nExisting panels: **${panels.length}**\nCreate a panel here, then use the dropdown above to switch systems.`))
        .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup-channel/reaction-roles').setPlaceholder('Choose panel channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setDefaultChannels(panelChannelId ? [panelChannelId] : [])))
        .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId('setup-reaction-roles').setPlaceholder('Select roles to add to a panel').setMinValues(1).setMaxValues(20)))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-reaction-create').setLabel('Use custom panel details').setStyle(ButtonStyle.Secondary)))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-enable/reaction-roles').setLabel(setupPanelRecord?.messageId ? 'Panel already posted' : 'Enable and post panel').setStyle(setupPanelRecord?.messageId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(Boolean(setupPanelRecord?.messageId))))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('setup-disable/reaction-roles').setLabel('Disable system').setStyle(ButtonStyle.Danger)))
        .addActionRowComponents(overviewButton());
}

function reactionCreateModal() {
    const modal = new ModalBuilder().setCustomId('setup-reaction-create-submit').setTitle('Create reaction roles');
    const field = (id: string, label: string, style: TextInputStyle, placeholder: string) => new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(style).setPlaceholder(placeholder).setRequired(true))
    return modal.addLabelComponents(
        field('channel-id', 'Text channel ID', TextInputStyle.Short, 'Right-click a channel and Copy ID'),
        field('panel-title', 'Panel title', TextInputStyle.Short, 'Choose your roles'),
        field('panel-description', 'Panel description', TextInputStyle.Paragraph, 'React below to add or remove a role.'),
        field('role-mappings', 'Emoji and role IDs', TextInputStyle.Paragraph, '🎮 = 123456789012345678, one per line')
    );
}

function nextId(existingIds: string[], prefix: string) {
    const next = existingIds.filter(id => id.startsWith(`${prefix}+`)).map(id => Number(id.slice(prefix.length + 1))).filter(Number.isInteger).reduce((highest, value) => Math.max(highest, value), 0) + 1;
    return `${prefix}+${String(next).padStart(3, '0')}`;
}

async function createReactionPanel(interaction: ModalSubmitInteraction, prisma: PrismaClient) {
    const channel = interaction.guild?.channels.cache.get(interaction.fields.getTextInputValue('channel-id').trim());
    const title = interaction.fields.getTextInputValue('panel-title').trim();
    const description = interaction.fields.getTextInputValue('panel-description').trim();
    const entries = interaction.fields.getTextInputValue('role-mappings').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [emoji, roleId] = line.split('=').map(value => value.trim());
        return { emoji, roleId };
    });
    if (!(channel instanceof TextChannel) || !title || !description || !entries.length || entries.some(entry => !entry.emoji || !entry.roleId)) {
        await interaction.reply({ content: 'Provide a valid text channel ID, title, description, and at least one `emoji = role ID` mapping.', flags: MessageFlags.Ephemeral });
        return;
    }
    const roles = entries.map(entry => interaction.guild?.roles.cache.get(entry.roleId));
    if (roles.some(role => !role || role.managed)) {
        await interaction.reply({ content: 'Every mapping must use an existing, non-managed role from this server.', flags: MessageFlags.Ephemeral });
        return;
    }
    const existing = await prisma.reactionRole.findMany({ select: { id: true } });
    const id = nextId(existing.map(panel => panel.id), interaction.guildId!.slice(-4));
    const message = await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x5865f2)] });
    await prisma.reactionRole.create({
        data: { id, gID: interaction.guildId!, messageId: message.id, channelId: channel.id, title, description, roles: { create: entries.map((entry, index) => ({ id: `${id}-${String(index + 1).padStart(3, '0')}`, roleId: entry.roleId, emoji: entry.emoji })) } }
    });
    await Promise.all(entries.map(entry => message.react(entry.emoji)));
    await interaction.reply({ content: `Reaction role panel **${id}** posted.`, flags: MessageFlags.Ephemeral });
}

async function createReactionPanelFromRoles(interaction: RoleSelectMenuInteraction, prisma: PrismaClient) {
    const panel = await setupPanel(prisma, interaction.guildId!, 'reaction-roles');
    const channel = interaction.guild?.channels.cache.get(panel?.channelId ?? '');
    if (!(channel instanceof TextChannel)) {
        await interaction.reply({ content: 'Choose a panel channel first.', flags: MessageFlags.Ephemeral });
        return;
    }
    const roles = interaction.values
        .map(roleId => interaction.guild?.roles.cache.get(roleId))
        .filter(role => role !== undefined)
        .filter(role => !role.managed);
    if (roles.length !== interaction.values.length) {
        await interaction.reply({ content: 'Select only existing, non-managed roles.', flags: MessageFlags.Ephemeral });
        return;
    }
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];
    const entries = roles.map((role, index) => ({ roleId: role.id, emoji: emojis[index] }));
    const existing = await prisma.reactionRole.findMany({ select: { id: true } });
    const id = nextId(existing.map(item => item.id), interaction.guildId!.slice(-4));
    const title = 'Choose your roles';
    const description = 'React below to add or remove a role.';
    const message = await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x5865f2)] });
    await prisma.reactionRole.create({
        data: { id, gID: interaction.guildId!, messageId: message.id, channelId: channel.id, title, description, roles: { create: entries.map((entry, index) => ({ id: `${id}-${String(index + 1).padStart(3, '0')}`, ...entry })) } }
    });
    await Promise.all(entries.map(entry => message.react(entry.emoji)));
    await interaction.reply({ content: `Reaction role panel **${id}** posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
}

export async function handleSetupInteraction(interaction: SetupInteraction, deps: SetupDeps) {
    if (!interaction.inGuild() || !isAdministrator(interaction)) {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Administrator permissions are required to configure Orchard.', flags: MessageFlags.Ephemeral });
        return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-system') {
        const system = interaction.values[0] as SetupSystem;
        if (isSetupSystem(system)) await interaction.update({ components: [await buildSetupContainer(system, interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
        return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-sticky-select') {
        const selectedId = interaction.values[0];
        const draft = stickyDraftFor(interaction.guildId!, interaction.user.id);
        const sticky = selectedId === 'none' ? null : (await deps.sticky.list(interaction.guildId!)).find(entry => entry.id === selectedId);
        if (!sticky) stickySetupDrafts.set(stickyDraftKey(interaction.guildId!, interaction.user.id), newStickyDraft());
        else stickySetupDrafts.set(stickyDraftKey(interaction.guildId!, interaction.user.id), {
            stickyId: sticky.id,
            channelId: sticky.channelId,
            mode: sticky.mode,
            content: sticky.content,
            title: sticky.title,
            description: sticky.description,
            color: sticky.color,
        });
        return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-sticky-mode') {
        const mode = interaction.values[0];
        if (mode !== 'Text' && mode !== 'Embed' && mode !== 'Container') return;
        stickyDraftFor(interaction.guildId!, interaction.user.id).mode = mode;
        return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-sticky-color') {
        const selected = stickyColors.find(color => color.value === interaction.values[0]);
        if (selected) stickyDraftFor(interaction.guildId!, interaction.user.id).color = selected.value;
        return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-welcome-mode') {
        const mode = interaction.values[0];
        if (!['text', 'embed', 'image'].includes(mode)) return;
        await deps.prisma.welcomeSettings.upsert({ where: { gID: interaction.guildId! }, update: { mode }, create: { gID: interaction.guildId!, mode } });
        return interaction.update({ components: [await buildSetupContainer('welcome', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && (interaction.customId === 'setup-birthday-announcement-channel' || interaction.customId === 'setup-birthday-log-channel')) {
        const field = interaction.customId === 'setup-birthday-announcement-channel' ? 'announceChannelId' : 'logChannelId';
        await deps.prisma.birthdaySettings.upsert({
            where: { gID: interaction.guildId! },
            update: { [field]: interaction.values[0] },
            create: { gID: interaction.guildId!, [field]: interaction.values[0] }
        });
        return interaction.update({ components: [await buildSetupContainer('birthdays', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'setup-verification-intro') {
        await deps.prisma.guild.upsert({
            where: { gID: interaction.guildId! },
            update: { introC: interaction.values[0] },
            create: { gID: interaction.guildId!, gName: interaction.guild?.name ?? 'Guild', introC: interaction.values[0] },
        });
        return interaction.update({ components: [await buildSetupContainer('verification', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('setup-community/')) {
        const field = interaction.customId.split('/')[1];
        const allowedFields = ['introC', 'announcementsChannelId', 'taskLogsChannelId', 'gamingChannelId', 'modC', 'leaveChannelId'] as const;
        if (!allowedFields.includes(field as typeof allowedFields[number])) return;
        const channelId = interaction.values[0] ?? '';
        const data = field === 'leaveChannelId'
            ? { leaveChannelId: channelId, leaveEnabled: Boolean(channelId) }
            : { [field]: channelId };
        await deps.prisma.guild.upsert({
            where: { gID: interaction.guildId! },
            update: data,
            create: { gID: interaction.guildId!, gName: interaction.guild?.name ?? 'Guild', ...data },
        });
        return interaction.update({ components: [await buildSetupContainer('community', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'setup-sticky-channel') {
        stickyDraftFor(interaction.guildId!, interaction.user.id).channelId = interaction.values[0];
        return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'setup-sticky-log-channel') {
        const logsChannelId = interaction.values[0] ?? '';
        await deps.prisma.stickySettings.upsert({
            where: { guildId: interaction.guildId! },
            update: { logsChannelId },
            create: { guildId: interaction.guildId!, logsChannelId },
        });
        return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'setup-verification-roles') {
        await deps.prisma.guild.upsert({
            where: { gID: interaction.guildId! },
            update: { rolesChannelId: interaction.values[0] },
            create: { gID: interaction.guildId!, gName: interaction.guild?.name ?? 'Guild', rolesChannelId: interaction.values[0] },
        });
        return interaction.update({ components: [await buildSetupContainer('verification', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('setup-channel/')) {
        const system = interaction.customId.split('/')[1] as SetupSystem;
        if (!isSetupSystem(system)) return;
        const channelId = interaction.values[0];
        await saveSetupChannel(deps.prisma, interaction.guildId!, system, channelId);
        await systemDefinitions[system].setChannel?.(deps.prisma, interaction.guildId!, channelId);
        return interaction.update({ components: [await buildSetupContainer(system, interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('setup-stats/')) {
        const field = { all: 'allCountChan', users: 'userCountChan', bots: 'botCountChan' }[interaction.customId.split('/')[1]] as 'allCountChan' | 'userCountChan' | 'botCountChan' | undefined;
        if (!field) return;
        return configureStatsChannel(interaction, deps.prisma, field);
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'setup-leveling-channel') {
        const channelId = interaction.values[0];
        await deps.prisma.levelSettings.upsert({ where: { gID: interaction.guildId! }, update: { channel: channelId }, create: { gID: interaction.guildId!, channel: channelId, enabled: true } });
        return interaction.update({ components: [await buildSetupContainer('leveling', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isRoleSelectMenu() && interaction.customId === 'setup-reaction-roles') {
        return createReactionPanelFromRoles(interaction, deps.prisma);
    }
    if (interaction.isRoleSelectMenu() && (interaction.customId === 'setup-verification-verified-role' || interaction.customId === 'setup-verification-nonverified-role')) {
        const field = interaction.customId === 'setup-verification-verified-role' ? 'verifiedRole' : 'nonVerifiedRoleId';
        await deps.prisma.guild.upsert({
            where: { gID: interaction.guildId! },
            update: { [field]: interaction.values[0] },
            create: { gID: interaction.guildId!, gName: interaction.guild?.name ?? 'Guild', [field]: interaction.values[0] },
        });
        return interaction.update({ components: [await buildSetupContainer('verification', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isButton()) {
        if (interaction.customId === 'setup-overview') return interaction.update({ components: [buildSetupOverview()], flags: MessageFlags.IsComponentsV2 });
        if (interaction.customId === 'setup-sticky-new') {
            stickySetupDrafts.set(stickyDraftKey(interaction.guildId!, interaction.user.id), newStickyDraft());
            return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId === 'setup-sticky-content') {
            return interaction.showModal(stickyContentModal(stickyDraftFor(interaction.guildId!, interaction.user.id)));
        }
        if (interaction.customId === 'setup-sticky-create') {
            const draft = stickyDraftFor(interaction.guildId!, interaction.user.id);
            const settings = await deps.prisma.stickySettings.findUnique({ where: { guildId: interaction.guildId! } });
            if (!draft.channelId || !settings?.logsChannelId) return interaction.reply({ content: 'Choose a sticky channel and startup log channel first.', flags: MessageFlags.Ephemeral });
            if (!(draft.mode === 'Embed' ? draft.description : draft.content).trim()) return interaction.reply({ content: 'Set the sticky content before creating it.', flags: MessageFlags.Ephemeral });
            try {
                const sticky = await deps.sticky.create(interaction.guildId!, draft.channelId, {
                    mode: draft.mode,
                    content: draft.mode === 'Embed' ? '' : draft.content,
                    title: draft.mode === 'Text' ? '' : 'Sticky Message',
                    description: draft.mode === 'Embed' ? draft.description : '',
                    color: draft.color,
                });
                draft.stickyId = sticky.id;
                return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
            } catch (error) {
                const message = error instanceof Error && error.message === 'CHANNEL_STICKY_EXISTS' ? 'This channel already has a sticky message.' : error instanceof Error ? error.message : 'Failed to create sticky message.';
                return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
            }
        }
        if (interaction.customId === 'setup-sticky-update') {
            const draft = stickyDraftFor(interaction.guildId!, interaction.user.id);
            if (!draft.stickyId) return interaction.reply({ content: 'Select a sticky message to edit first.', flags: MessageFlags.Ephemeral });
            if (!(draft.mode === 'Embed' ? draft.description : draft.content).trim()) return interaction.reply({ content: 'Set the sticky content before saving changes.', flags: MessageFlags.Ephemeral });
            try {
                const sticky = await deps.sticky.update(interaction.guildId!, draft.stickyId, {
                    channelId: draft.channelId,
                    mode: draft.mode,
                    content: draft.mode === 'Embed' ? '' : draft.content,
                    title: draft.mode === 'Text' ? '' : 'Sticky Message',
                    description: draft.mode === 'Embed' ? draft.description : '',
                    color: draft.color,
                });
                if (!sticky) return interaction.reply({ content: 'That sticky message no longer exists.', flags: MessageFlags.Ephemeral });
                return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
            } catch (error) {
                const message = error instanceof Error && error.message === 'CHANNEL_STICKY_EXISTS' ? 'This channel already has a sticky message.' : error instanceof Error ? error.message : 'Failed to update sticky message.';
                return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
            }
        }
        if (interaction.customId === 'setup-sticky-delete') {
            const draft = stickyDraftFor(interaction.guildId!, interaction.user.id);
            if (!draft.stickyId) return interaction.reply({ content: 'Select a sticky message to delete first.', flags: MessageFlags.Ephemeral });
            await deps.sticky.delete(interaction.guildId!, draft.stickyId);
            stickySetupDrafts.set(stickyDraftKey(interaction.guildId!, interaction.user.id), newStickyDraft());
            return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId === 'setup-sticky-toggle') {
            const settings = await deps.prisma.stickySettings.findUnique({ where: { guildId: interaction.guildId! } });
            if (!settings?.logsChannelId) return interaction.reply({ content: 'Choose a startup log channel before enabling sticky messages.', flags: MessageFlags.Ephemeral });
            await deps.prisma.stickySettings.update({ where: { guildId: interaction.guildId! }, data: { enabled: !settings.enabled } });
            return interaction.update({ components: [await buildSetupContainer('stickies', interaction.guildId!, deps.prisma, interaction.user.id)], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId === 'setup-reaction-create') return interaction.showModal(reactionCreateModal());
        if (interaction.customId === 'setup-stats-create') return interaction.showModal(serverStatsModal());
        if (interaction.customId === 'setup-verification-create') return createVerificationPanel(interaction, deps.prisma);
        if (interaction.customId === 'setup-leveling-rewards') {
            const settings = await deps.prisma.levelSettings.upsert({ where: { gID: interaction.guildId! }, update: {}, create: { gID: interaction.guildId! } });
            return interaction.showModal(levelingModal(settings));
        }
        if (interaction.customId.startsWith('setup-disable/')) {
            const system = interaction.customId.split('/')[1] as SetupSystem;
            if (!isSetupSystem(system)) return;
            await disableSystem(interaction, system, deps.prisma, deps.sticky);
            return interaction.update({ components: [await buildSetupContainer(system, interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId.startsWith('setup-enable/')) {
            const system = interaction.customId.split('/')[1] as SetupSystem;
            if (system === 'economy') return interaction.showModal(economyModal());
            if (isSetupSystem(system)) return interaction.showModal(enablePanelModal(system));
        }
        if (interaction.customId === 'setup-economy-edit') return interaction.showModal(economyModal());
        if (interaction.customId.startsWith('setup-welcome-avatar/')) {
            const position = interaction.customId.split('/')[1];
            if (positions.includes(position as typeof positions[number])) await deps.prisma.welcomeSettings.upsert({ where: { gID: interaction.guildId! }, update: { avatarPosition: position }, create: { gID: interaction.guildId!, avatarPosition: position } });
            return interaction.update({ components: [await buildSetupContainer('welcome', interaction.guildId!, deps.prisma)], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId === 'setup-welcome-background') {
            const settings = await deps.prisma.welcomeSettings.findUnique({ where: { gID: interaction.guildId! } });
            const input = new TextInputBuilder().setCustomId('background-url').setStyle(TextInputStyle.Short).setRequired(false).setValue(settings?.backgroundUrl || defaultWelcomeBackgroundUrl).setPlaceholder('Leave blank to restore the Orchard default');
            return interaction.showModal(new ModalBuilder().setCustomId('setup-welcome-background-submit').setTitle('Welcome background').addLabelComponents(new LabelBuilder().setLabel('Public HTTPS image URL').setTextInputComponent(input)));
        }
        if (interaction.customId === 'setup-welcome-content') {
            const settings = await deps.prisma.welcomeSettings.findUnique({ where: { gID: interaction.guildId! } });
            return interaction.showModal(welcomeContentModal(settings ?? {}));
        }
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-welcome-background-submit') {
        const value = interaction.fields.getTextInputValue('background-url').trim();
        let valid = true;
        if (value) {
            try { valid = new URL(value).protocol === 'https:'; } catch { valid = false; }
        }
        if (!valid) return interaction.reply({ content: 'Please provide a valid HTTPS image URL.', flags: MessageFlags.Ephemeral });
        await deps.prisma.welcomeSettings.upsert({ where: { gID: interaction.guildId! }, update: { backgroundUrl: value }, create: { gID: interaction.guildId!, backgroundUrl: value } });
        return interaction.reply({ content: value ? 'Welcome background updated.' : 'Welcome background reset to the Orchard default.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-sticky-content-submit') {
        const draft = stickyDraftFor(interaction.guildId!, interaction.user.id);
        const content = interaction.fields.getTextInputValue('sticky-body').trim();
        if (!content) return interaction.reply({ content: 'Sticky message content cannot be empty.', flags: MessageFlags.Ephemeral });
        if (draft.mode === 'Embed') draft.description = content;
        else draft.content = content;
        return interaction.reply({ content: 'Sticky content saved to your setup draft.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-welcome-content') {
        const message = interaction.fields.getTextInputValue('welcome-message').trim();
        const title = interaction.fields.getTextInputValue('embed-title').trim();
        const description = interaction.fields.getTextInputValue('embed-description').trim();
        const color = interaction.fields.getTextInputValue('embed-color').trim();
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return interaction.reply({ content: 'Embed color must be a hex color such as #5865F2.', flags: MessageFlags.Ephemeral });
        await deps.prisma.$transaction([
            deps.prisma.welcomeSettings.upsert({ where: { gID: interaction.guildId! }, update: { embedTitle: title, embedDescription: description, embedColor: color || '#5865F2' }, create: { gID: interaction.guildId!, embedTitle: title, embedDescription: description, embedColor: color || '#5865F2' } }),
            deps.prisma.botWelcomeMessages.upsert({ where: { gID: interaction.guildId! }, update: { messagesArray: message ? [message] : [], singleMessage: true }, create: { gID: interaction.guildId!, messagesArray: message ? [message] : [], singleMessage: true } }),
        ]);
        return interaction.reply({ content: 'Welcome content saved. Preview it in the welcome panel before enabling the system.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-server-stats-create') return createServerStatsChannels(interaction, deps.prisma);
    if (interaction.isModalSubmit() && interaction.customId === 'setup-leveling-rewards') {
        const value = (id: string) => Math.max(0, Number.parseInt(interaction.fields.getTextInputValue(id), 10) || 0);
        await deps.prisma.levelSettings.upsert({ where: { gID: interaction.guildId! }, update: { firstReward: value('first-reward'), secondReward: value('second-reward'), thirdReward: value('third-reward'), participantReward: value('participant-reward') }, create: { gID: interaction.guildId!, firstReward: value('first-reward'), secondReward: value('second-reward'), thirdReward: value('third-reward'), participantReward: value('participant-reward') } });
        return interaction.reply({ content: 'Weekly leveling rewards saved.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('setup-enable-submit/')) {
        const system = interaction.customId.split('/')[1] as SetupSystem;
        if (!isSetupSystem(system)) return;
        await systemDefinitions[system].enable(deps.prisma, interaction.guildId!);
        return postSystemPanel(interaction, system, deps.prisma);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-economy-submit') {
        const isHttps = (value: string) => {
            if (!value) return true;
            try { return new URL(value).protocol === 'https:'; } catch { return false; }
        };
        const currencyImageUrl = interaction.fields.getTextInputValue('currency-image').trim();
        const bankImageUrl = interaction.fields.getTextInputValue('bank-image').trim();
        if (!isHttps(currencyImageUrl) || !isHttps(bankImageUrl)) return interaction.reply({ content: 'Image URLs must be valid HTTPS URLs.', flags: MessageFlags.Ephemeral });
        await deps.prisma.economySettings.upsert({
            where: { gID: interaction.guildId! },
            update: { currencyName: interaction.fields.getTextInputValue('currency-name').trim() || 'Coins', bankName: interaction.fields.getTextInputValue('bank-name').trim() || 'Bank', currencyImageUrl, bankImageUrl },
            create: { gID: interaction.guildId!, currencyName: interaction.fields.getTextInputValue('currency-name').trim() || 'Coins', bankName: interaction.fields.getTextInputValue('bank-name').trim() || 'Bank', currencyImageUrl, bankImageUrl },
        });
        return interaction.reply({ content: 'Economy settings updated.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit() && interaction.customId === 'setup-reaction-create-submit') return createReactionPanel(interaction, deps.prisma);
}
