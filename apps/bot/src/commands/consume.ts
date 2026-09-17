import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import type { PrismaClient } from '#utils';
import { recipeBoosts } from '#utils';

function inventoryId(userId: string, serverId: string, item: string) {
    return `${userId}-${serverId}-${item.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
}

export default commandModule({
    type: CommandType.Slash,
    description: 'Consume a crafted meal for an economy boost.',
    options: [{
        type: ApplicationCommandOptionType.String,
        name: 'recipe',
        description: 'Crafted meal to consume.',
        required: true,
        choices: [
            { name: 'Bread · 15% boost · 30 minutes', value: 'bread' },
            { name: 'Vegetable soup · 30% boost · 60 minutes', value: 'soup' },
            { name: 'Apple pie · 50% boost · 90 minutes', value: 'pie' },
        ],
    }],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        const recipeKey = ctx.options.getString('recipe', true) as keyof typeof recipeBoosts;
        const recipe = recipeBoosts[recipeKey];
        const item = await deps.prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId: ctx.user.id, serverId: ctx.guildId, item: recipe.item } } });
        if (!item || item.quantity < 1) return ctx.reply({ content: `You do not have any **${recipe.item}** to consume.`, flags: MessageFlags.Ephemeral });
        const expiresAt = new Date(Date.now() + recipe.minutes * 60_000);
        await deps.prisma.$transaction([
            deps.prisma.economyItem.update({ where: { userId_serverId_item: { userId: ctx.user.id, serverId: ctx.guildId, item: recipe.item } }, data: { quantity: { decrement: 1 } } }),
            deps.prisma.economyBoost.upsert({
                where: { userId_serverId: { userId: ctx.user.id, serverId: ctx.guildId } },
                update: { recipe: recipeKey, multiplier: recipe.multiplier, expiresAt },
                create: { id: inventoryId(ctx.user.id, ctx.guildId, 'boost'), userId: ctx.user.id, serverId: ctx.guildId, recipe: recipeKey, multiplier: recipe.multiplier, expiresAt },
            }),
        ]);
        return ctx.reply({ content: `You consumed **${recipe.item}**. Your economy boost is active until <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`, flags: MessageFlags.Ephemeral });
    },
});