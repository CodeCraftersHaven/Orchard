import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, ChannelType, GuildMember, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { IntegrationContextType, publishConfig } from '#plugins';
import { stickyColors, type StickyContent } from '#utils';

const stickyIdOption = () => ({
    type: ApplicationCommandOptionType.String as const,
    name: 'sticky',
    description: 'Choose one of this server\'s sticky messages.',
    required: true as const,
    autocomplete: true as const,
    command: {
        onEvent: [],
        async execute(ctx, { deps }) {
            if (!ctx.inGuild || !ctx.guildId) return ctx.respond([]);
            const focused = ctx.options.getFocused().toLowerCase();
            const stickies = await deps.prisma.sticky.findMany({ where: { stickySettingsGuildId: ctx.guildId }, orderBy: { id: 'asc' } });
            await ctx.respond(stickies
                .filter(sticky => `${sticky.id} ${sticky.channelId} ${sticky.mode} ${sticky.title} ${sticky.content}`.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(sticky => ({ name: `#${sticky.channelId} - ${sticky.mode} - ${sticky.id}`.slice(0, 100), value: sticky.id })));
        },
    },
});

const stickyTitle = 'Sticky Message';

function hasManageMessages(ctx: { member: unknown }) {
    return (ctx.member as GuildMember).permissions.has(PermissionFlagsBits.ManageMessages);
}

function stickyActionError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message === 'CHANNEL_STICKY_EXISTS') return 'This channel already has a sticky message.';
    return error instanceof Error ? error.message : fallback;
}

export default commandModule({
    type: CommandType.Slash,
    name: 'sticky',
    description: 'Create and manage this server\'s sticky messages.',
    plugins: [publishConfig({ defaultMemberPermissions: PermissionFlagsBits.ManageMessages, contexts: [IntegrationContextType.GUILD], integrationTypes: ['Guild'] })],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'create-text', description: 'Post a regular sticky message.', options: [
                { type: ApplicationCommandOptionType.String, name: 'message', description: 'Message text.', required: true, max_length: 2000 },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Channel to keep the sticky in.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'create-embed', description: 'Post an embed sticky message.', options: [
                { type: ApplicationCommandOptionType.String, name: 'description', description: 'Embed description.', required: true, max_length: 4000 },
                { type: ApplicationCommandOptionType.String, name: 'color', description: 'Embed color.', required: false, choices: stickyColors },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Channel to keep the sticky in.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'create-container', description: 'Post a container sticky message.', options: [
                { type: ApplicationCommandOptionType.String, name: 'content', description: 'Container text.', required: true, max_length: 4000 },
                { type: ApplicationCommandOptionType.String, name: 'color', description: 'Container accent color.', required: false, choices: stickyColors },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Channel to keep the sticky in.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'edit-text', description: 'Edit a regular sticky message.', options: [
                stickyIdOption(),
                { type: ApplicationCommandOptionType.String, name: 'message', description: 'New message text.', required: false, max_length: 2000 },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Move the sticky to another channel.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'edit-embed', description: 'Edit an embed sticky message.', options: [
                stickyIdOption(),
                { type: ApplicationCommandOptionType.String, name: 'description', description: 'New embed description.', required: false, max_length: 4000 },
                { type: ApplicationCommandOptionType.String, name: 'color', description: 'New embed color.', required: false, choices: stickyColors },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Move the sticky to another channel.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand, name: 'edit-container', description: 'Edit a container sticky message.', options: [
                stickyIdOption(),
                { type: ApplicationCommandOptionType.String, name: 'content', description: 'New container text.', required: false, max_length: 4000 },
                { type: ApplicationCommandOptionType.String, name: 'color', description: 'New container accent color.', required: false, choices: stickyColors },
                { type: ApplicationCommandOptionType.Channel, name: 'channel', description: 'Move the sticky to another channel.', required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
            ]
        },
        { type: ApplicationCommandOptionType.Subcommand, name: 'delete', description: 'Delete one of this server\'s sticky messages.', options: [stickyIdOption()] },
        { type: ApplicationCommandOptionType.Subcommand, name: 'list', description: 'List this server\'s sticky messages.' },
    ],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        if (!hasManageMessages(ctx)) return ctx.reply({ content: 'Manage Messages permission is required.', flags: MessageFlags.Ephemeral });

        const subcommand = ctx.options.getSubcommand(true);
        const stickyService = deps['sticky'];
        if (subcommand === 'list') {
            const stickies = await stickyService.list(ctx.guildId);
            const details = stickies.slice(0, 15).map(sticky => `**${sticky.mode}** in <#${sticky.channelId}> · \`${sticky.id}\``);
            return ctx.reply({ content: details.length ? `Sticky messages (${stickies.length}):\n${details.join('\n')}${stickies.length > 15 ? '\n…and more. Use autocomplete in edit/delete to find a sticky.' : ''}` : 'This server has no sticky messages.', flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'delete') {
            const stickyId = ctx.options.getString('sticky', true);
            let deleted: boolean;
            try {
                deleted = await stickyService.delete(ctx.guildId, stickyId);
            } catch (error) {
                return ctx.reply({ content: error instanceof Error ? error.message : 'Failed to delete that sticky message.', flags: MessageFlags.Ephemeral });
            }
            return ctx.reply({ content: deleted ? 'Sticky message deleted.' : 'That sticky message was not found in this server.', flags: MessageFlags.Ephemeral });
        }

        const selectedChannel = ctx.options.getChannel('channel');
        const mode: StickyContent['mode'] = subcommand.endsWith('text')
            ? 'Text'
            : subcommand.endsWith('embed') ? 'Embed' : 'Container';
        const isEmbed = mode === 'Embed';
        const body = ctx.options.getString(isEmbed ? 'description' : mode === 'Text' ? 'message' : 'content');
        const color = isEmbed || mode === 'Container' ? ctx.options.getString('color') : null;

        if (subcommand.startsWith('create-')) {
            const channelId = selectedChannel?.id ?? ctx.channelId;
            if (!body?.trim()) return ctx.reply({ content: isEmbed ? 'An embed description is required.' : 'Sticky message content is required.', flags: MessageFlags.Ephemeral });
            let sticky;
            try {
                sticky = await stickyService.create(ctx.guildId, channelId, {
                    mode,
                    content: isEmbed ? '' : body,
                    title: isEmbed ? stickyTitle : '',
                    description: isEmbed ? body : '',
                    color: color ?? '#5865F2',
                });
            } catch (error) {
                return ctx.reply({ content: stickyActionError(error, 'Failed to create that sticky message.'), flags: MessageFlags.Ephemeral });
            }
            return ctx.reply({ content: `Sticky message created in <#${sticky.channelId}>. ID: \`${sticky.id}\``, flags: MessageFlags.Ephemeral });
        }

        const stickyId = ctx.options.getString('sticky', true);
        const existing = (await stickyService.list(ctx.guildId)).find(sticky => sticky.id === stickyId);
        if (!existing) return ctx.reply({ content: 'That sticky message was not found in this server.', flags: MessageFlags.Ephemeral });
        if (existing.mode !== mode) return ctx.reply({ content: `That sticky uses ${existing.mode}. Use the matching edit-${existing.mode.toLowerCase()} subcommand.`, flags: MessageFlags.Ephemeral });
        if (body === null && color === null && !selectedChannel) return ctx.reply({ content: 'Choose at least one field to edit.', flags: MessageFlags.Ephemeral });
        const changes: Partial<StickyContent> = {
            mode,
            ...(selectedChannel ? { channelId: selectedChannel.id } : {}),
            ...(isEmbed ? { title: stickyTitle, ...(body !== null ? { description: body } : {}) } : body !== null ? { content: body } : {}),
            ...(color !== null ? { color } : {}),
        };
        let sticky;
        try {
            sticky = await stickyService.update(ctx.guildId, stickyId, changes);
        } catch (error) {
            return ctx.reply({ content: stickyActionError(error, 'Failed to update that sticky message.'), flags: MessageFlags.Ephemeral });
        }
        return ctx.reply({ content: sticky ? `Sticky message updated in <#${sticky.channelId}>.` : 'That sticky message was not found in this server.', flags: MessageFlags.Ephemeral });
    },
});