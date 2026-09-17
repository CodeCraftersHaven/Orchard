import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import { publishConfig, IntegrationContextType } from '#plugins';
import { buildLevelCard, economyLabels, levelingMedals, levelFromTotalXp, resetWeeklyLeveling, settleWeeklyLeveling } from '#utils';

export default commandModule({
    type: CommandType.Slash,
    description: 'View your rank or the weekly XP leaderboard.',
    plugins: [publishConfig({ contexts: [IntegrationContextType.GUILD], integrationTypes: ['Guild'] })],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'rank',
            description: 'View a canvas rank card.',
            options: [{ type: ApplicationCommandOptionType.User, name: 'member', description: 'Member to check.', required: false }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'leaderboard',
            description: 'View the server XP leaderboard.',
        },
    ],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        const prisma = deps.prisma;
        const serverId = ctx.guildId;
        const { currencyName } = await economyLabels(deps.prisma, serverId);
        const subcommand = ctx.options.getSubcommand(true);

        const levelSettings = await prisma.levelSettings.findUnique({ where: { gID: serverId } });
        if (!levelSettings?.enabled) return ctx.reply({ content: 'The leveling system is not enabled in this server.', flags: MessageFlags.Ephemeral });
        await resetWeeklyLeveling(deps.prisma, serverId);

        if (subcommand === 'rank') {
            const target = ctx.options.getUser('member') ?? ctx.user;
            const entry = await prisma.levelUser.findUnique({ where: { userId_serverId: { userId: target.id, serverId } } });
            const totalXp = entry?.xp ?? 0;
            return ctx.reply({ files: [await buildLevelCard(target.username, target.displayAvatarURL({ extension: 'png', size: 256 }), totalXp)], flags: MessageFlags.Ephemeral });
        }

        const top = await prisma.levelUser.findMany({ where: { serverId, weeklyXp: { gt: 0 } }, orderBy: { weeklyXp: 'desc' }, take: 10 });
        if (!top.length) return ctx.reply({ content: 'No one has earned any XP yet.', flags: MessageFlags.Ephemeral });
        await settleWeeklyLeveling(prisma, serverId, levelSettings, top);
        const xpRewards = [levelSettings.firstReward, levelSettings.secondReward, levelSettings.thirdReward];
        const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🏆 Weekly XP leaderboard\nTop 3 earn XP: ${xpRewards.join(' / ')}. Everyone in the top 10 earns ${levelSettings.participantReward} ${currencyName}.`));
        for (let index = 0; index < top.length; index++) container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${levelingMedals[index] ?? `**#${index + 1}**`} <@${top[index].userId}> • **${top[index].weeklyXp.toLocaleString()} XP** • **${levelSettings.participantReward} ${currencyName}**${index < 3 ? ` • **+${xpRewards[index]} XP**` : ''}`));
        return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },
});
