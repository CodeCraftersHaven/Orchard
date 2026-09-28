import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { IntegrationContextType, publishConfig } from '#plugins';
import { buildPollContainer, createPollDraft } from '#utils';

export default commandModule({
    type: CommandType.Slash,
    name: 'poll',
    description: 'Build and send a poll to a channel.',
    plugins: [
        publishConfig({
            defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
            contexts: [IntegrationContextType.GUILD],
            integrationTypes: ['Guild'],
        }),
    ],
    async execute(ctx) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        const draft = createPollDraft(ctx.guildId, ctx.user.id);
        return ctx.reply({ components: [buildPollContainer(draft, ctx.user)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },
});
