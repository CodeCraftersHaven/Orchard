import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import { getActiveEconomyBoost, inventoryId } from './economy.js';

type WalletViewer = { userId: string; username: string; serverId: string };

export async function buildWalletContainer(prisma: PrismaClient, viewer: WalletViewer) {
    const economy = await prisma.economySettings.findUnique({ where: { gID: viewer.serverId } });
    const [profile, wallet, inventory, plot, craft, boost] = await Promise.all([
        prisma.moneyUser.findUnique({ where: { id: viewer.userId } }),
        prisma.moneyWallet.findUnique({ where: { userId_serverId: { userId: viewer.userId, serverId: viewer.serverId } } }),
        prisma.economyItem.findMany({ where: { userId: viewer.userId, serverId: viewer.serverId, quantity: { gt: 0 } }, orderBy: { item: 'asc' } }),
        prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId: viewer.userId, serverId: viewer.serverId } } }),
        prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId: viewer.userId, serverId: viewer.serverId } } }),
        getActiveEconomyBoost(prisma, viewer.userId, viewer.serverId),
    ]);
    const bankName = economy?.bankName ?? 'Bank';
    const currencyName = economy?.currencyName ?? 'Coins';
    const inventoryText = inventory.length ? inventory.map(item => `- ${item.item}: **${item.quantity}**`).join('\n') : 'Empty';
    const activities = [
        plot ? `Farm: **${plot.crop}** ready <t:${Math.floor(plot.readyAt.getTime() / 1000)}:R>` : 'Farm: empty',
        craft ? `Kitchen: **${craft.output}** ready <t:${Math.floor(craft.readyAt.getTime() / 1000)}:R>` : 'Kitchen: idle',
        boost ? `Boost: **${boost.recipe}** at **${Math.round(boost.multiplier * 100 - 100)}%** until <t:${Math.floor(boost.expiresAt.getTime() / 1000)}:R>` : 'Boost: none',
    ].join('\n');
    const now = Date.now();
    const hasReadyActivity = Boolean(plot?.readyAt.getTime()! <= now || craft?.readyAt.getTime()! <= now);

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${viewer.username}'s economy profile`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`💰 **${bankName}:** ${profile?.bank ?? 0} ${currencyName}\n👛 **Server wallet:** ${wallet?.wallet ?? 0} ${currencyName}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('### Inventory'));
    for (const item of inventory) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`📦 **${item.item}** • Quantity: **${item.quantity}**`));
    if (!inventory.length) container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Inventory is empty.'));
    container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent('### Activities'));
    for (const activity of activities.split('\n')) {
        const separator = activity.indexOf(': ');
        const label = separator === -1 ? 'Activity' : activity.slice(0, separator);
        const status = separator === -1 ? activity : activity.slice(separator + 2);
        const emoji = label === 'Farm' ? '🌱' : label === 'Kitchen' ? '🍞' : '✨';
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji} **${label}:** ${status}`));
    }
    if (hasReadyActivity) {
        container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`wallet-collect/${viewer.userId}`).setLabel('Collect ready').setStyle(ButtonStyle.Success),
        ));
    }
    return container;
}

export async function handleWalletInteraction(interaction: ButtonInteraction, prisma: PrismaClient) {
    const [action, userId] = interaction.customId.split('/');
    if (action !== 'wallet-collect' || userId !== interaction.user.id || !interaction.guildId) return false;
    const serverId = interaction.guildId;
    const [plot, craft] = await Promise.all([
        prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } }),
        prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } }),
    ]);
    const now = Date.now();
    const readyPlot = plot && plot.readyAt.getTime() <= now ? plot : null;
    const readyCraft = craft && craft.readyAt.getTime() <= now ? craft : null;
    if (!readyPlot && !readyCraft) {
        return void await interaction.reply({ content: 'Nothing is ready to collect.', flags: MessageFlags.Ephemeral });
    }

    await prisma.$transaction(async transaction => {
        if (readyPlot) {
            const quantity = Math.floor(Math.random() * 3) + 2;
            await transaction.economyFarmPlot.delete({ where: { id: readyPlot.id } });
            await transaction.economyItem.upsert({
                where: { userId_serverId_item: { userId, serverId, item: readyPlot.crop } },
                update: { quantity: { increment: quantity } },
                create: { id: inventoryId(userId, serverId, readyPlot.crop), userId, serverId, item: readyPlot.crop, quantity },
            });
        }
        if (readyCraft) {
            await transaction.economyCraftJob.delete({ where: { id: readyCraft.id } });
            await transaction.economyItem.upsert({
                where: { userId_serverId_item: { userId, serverId, item: readyCraft.output } },
                update: { quantity: { increment: readyCraft.quantity } },
                create: { id: inventoryId(userId, serverId, readyCraft.output), userId, serverId, item: readyCraft.output, quantity: readyCraft.quantity },
            });
        }
    });
    return void await interaction.update({ components: [await buildWalletContainer(prisma, { userId, username: interaction.user.username, serverId })], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}
