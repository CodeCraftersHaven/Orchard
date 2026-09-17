import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { economyLabels, type PrismaClient } from '#utils';

export default commandModule({
    type: CommandType.Slash,
    description: 'Deposit wallet coins into your global bank.',
    options: [{ type: ApplicationCommandOptionType.Integer, name: 'amount', description: 'Amount to deposit.', required: true, min_value: 1 }],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        const { currencyName, bankName } = await economyLabels(deps.prisma, ctx.guildId);
        const amount = ctx.options.getInteger('amount', true);
        const wallet = await deps.prisma.moneyWallet.findUnique({ where: { userId_serverId: { userId: ctx.user.id, serverId: ctx.guildId } } });
        if (!wallet || wallet.wallet < amount) return ctx.reply({ content: `You do not have enough ${currencyName.toLowerCase()} in this server wallet.`, flags: MessageFlags.Ephemeral });
        await deps.prisma.$transaction([
            deps.prisma.moneyWallet.update({ where: { userId_serverId: { userId: ctx.user.id, serverId: ctx.guildId } }, data: { wallet: { decrement: amount } } }),
            deps.prisma.moneyUser.upsert({ where: { id: ctx.user.id }, update: { bank: { increment: amount } }, create: { id: ctx.user.id, username: ctx.user.username, bank: amount } }),
        ]);
        return ctx.reply({ content: `Deposited **${amount} ${currencyName}** into your global ${bankName.toLowerCase()}.`, flags: MessageFlags.Ephemeral });
    },
});