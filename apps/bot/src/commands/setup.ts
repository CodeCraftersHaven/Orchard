import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { buildSetupOverview } from '#utils';
import { publishConfig, IntegrationContextType } from '#plugins';

export default commandModule({
    type: CommandType.Slash,
    description: 'Open Pomona\'s system setup panel.',
    plugins: [
        publishConfig({
            defaultMemberPermissions: PermissionFlagsBits.Administrator,
            contexts: [
                IntegrationContextType.GUILD
            ],
            integrationTypes: [
                'Guild'
            ]
        })
    ],
    async execute(ctx) {
        await ctx.reply({ components: [buildSetupOverview()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
});
