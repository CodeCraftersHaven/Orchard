import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, PermissionsBitField, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { PrismaClient } from "@prisma/client";

export const defaultDefinitions = [
    { item: 'Heist Loot', game: 'heist', value: 100 },
    { item: 'Old Coin', game: 'scavenger-hunt', value: 18 },
    { item: 'Ancient Map', game: 'scavenger-hunt', value: 42 },
    { item: 'Polished Gem', game: 'scavenger-hunt', value: 75 },
    { item: 'Mysterious Key', game: 'scavenger-hunt', value: 110 },
    { item: 'Minnow', game: 'fishing', value: 12 },
    { item: 'Silver Trout', game: 'fishing', value: 35 },
    { item: 'Golden Koi', game: 'fishing', value: 90 },
    { item: 'Message in a Bottle', game: 'fishing', value: 140 },
    { item: 'Wheat Seed', game: 'farming', value: 4 },
    { item: 'Carrot Seed', game: 'farming', value: 6 },
    { item: 'Apple Seed', game: 'farming', value: 10 },
    { item: 'Wheat', game: 'farming', value: 16 },
    { item: 'Carrot', game: 'farming', value: 22 },
    { item: 'Apple', game: 'farming', value: 30 },
    { item: 'Bread', game: 'farming', value: 55 },
    { item: 'Vegetable Soup', game: 'farming', value: 85 },
    { item: 'Apple Pie', game: 'farming', value: 120 },
    { item: 'Mystery Box', game: 'heist', value: 200 },
    { item: 'Golden Ticket', game: 'heist', value: 500 },
    { item: 'Silver Ticket', game: 'heist', value: 300 },
    { item: 'Bronze Ticket', game: 'heist', value: 150 },
    { item: 'Platinum Ticket', game: 'heist', value: 750 },
    { item: 'Diamond Ticket', game: 'heist', value: 1000 },
    { item: 'Emerald Ticket', game: 'heist', value: 1250 },
    { item: 'Ruby Ticket', game: 'heist', value: 1500 },
    { item: 'Sapphire Ticket', game: 'heist', value: 1750 },
    { item: 'Obsidian Ticket', game: 'heist', value: 2000 },
    { item: 'Crystal Ticket', game: 'heist', value: 2250 },
    { item: 'Katfish', game: 'fishing', value: 100 }
];

export function inventoryId(userId: string, serverId: string, item: string) {
    return `${userId}-${serverId}-${item.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
}

export function itemDefinitionId(serverId: string, item: string) {
    return `${serverId}-${item.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
}

export async function ensureItemDefinitions(prisma: PrismaClient, serverId: string) {
    await Promise.all(defaultDefinitions.map(definition => prisma.economyItemDefinition.upsert({
        where: { serverId_item: { serverId, item: definition.item } },
        update: {},
        create: { id: itemDefinitionId(serverId, definition.item), serverId, ...definition },
    })));
    return prisma.economyItemDefinition.findMany({ where: { serverId }, orderBy: { item: 'asc' } });
}

export function isAdministrator(ctx: { member?: unknown }) {
    return Boolean(ctx.member && typeof ctx.member === 'object' && 'permissions' in ctx.member && (ctx.member as { permissions: PermissionsBitField }).permissions.has(PermissionFlagsBits.Administrator));
}

export function isItemManagement(subcommand: string) {
    return subcommand === 'item-add' || subcommand === 'item-edit' || subcommand === 'item-remove';
}

export function categoryLabel(category: string) {
    return category.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export const activityOrder = ['heist', 'scavenger-hunt', 'fishing', 'farming'];

export const itemEmojis: Record<string, string> = {
    'Heist Loot': '💰',
    'Old Coin': '🪙',
    'Ancient Map': '🗺️',
    'Polished Gem': '💎',
    'Mysterious Key': '🗝️',
    Minnow: '🐟',
    'Silver Trout': '🐠',
    'Golden Koi': '🎏',
    'Message in a Bottle': '🍾',
    'Wheat Seed': '🌾',
    'Carrot Seed': '🥕',
    'Apple Seed': '🍎',
    Wheat: '🌾',
    Carrot: '🥕',
    Apple: '🍎',
    Bread: '🍞',
    'Vegetable Soup': '🥣',
    'Apple Pie': '🥧',
};

export const activityEmojis: Record<string, string> = {
    heist: '💰',
    'scavenger-hunt': '🧭',
    fishing: '🎣',
    farming: '🌱'
};

export function itemEmoji(item: string, activity: string) {
    return itemEmojis[item] ?? activityEmojis[activity] ?? '✨';
}

export function marketPrice(item: string, value: number) {
    const seedPrices: Record<string, number> = { 'Wheat Seed': 20, 'Carrot Seed': 30, 'Apple Seed': 45 };
    return seedPrices[item] ?? value;
}

export function economyTable(title: string, headers: string[], rows: string[][]) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
    for (const row of rows) {
        container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent(row.map((value, index) => `**${headers[index]}:** ${value}`).join(' • ')));
    }
    return container;
}

export function economyReply(title: string, headers: string[], rows: string[][]) {
    return {
        components: [economyTable(title, headers, rows)],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
}

export function itemCatalogContainer(definitions: typeof defaultDefinitions, currencyName: string) {
    const itemsByActivity = [...definitions].sort((left, right) => {
        const activityDifference = (activityOrder.indexOf(left.game) === -1 ? activityOrder.length : activityOrder.indexOf(left.game))
            - (activityOrder.indexOf(right.game) === -1 ? activityOrder.length : activityOrder.indexOf(right.game));
        return activityDifference || left.item.localeCompare(right.item);
    });
    const grouped = new Map<string, typeof itemsByActivity>();
    for (const item of itemsByActivity) {
        const items = grouped.get(item.game) ?? [];
        items.push(item);
        grouped.set(item.game, items);
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Economy item catalog\nItems grouped by activity.'));
    for (const [activity, items] of grouped) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `### ${activityEmojis[activity] ?? '✨'} ${categoryLabel(activity)}`,
                ...items.map(item => `${itemEmoji(item.item, activity)} **${item.item}** • ${item.value} ${currencyName}`),
            ].join('\n')));
    }
    return container;
}

export async function economyLabels(prisma: PrismaClient, serverId: string) {
    const settings = await prisma.economySettings.findUnique({ where: { gID: serverId }, select: { currencyName: true, bankName: true } });
    return { currencyName: settings?.currencyName ?? 'Coins', bankName: settings?.bankName ?? 'Bank' };
}

export function economyResponse(content: string, title = 'Economy') {
    return {
        components: [new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
}

export function gameResponse(content: string, title = 'Game') {
    return {
        components: [new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))],
        flags: Number(MessageFlags.IsComponentsV2),
    };
}

export const itemPools = {
    'scavenger-hunt': [
        { item: 'Old Coin', value: 18 },
        { item: 'Ancient Map', value: 42 },
        { item: 'Polished Gem', value: 75 },
        { item: 'Mysterious Key', value: 110 },
    ],
    fishing: [
        { item: 'Minnow', value: 12 },
        { item: 'Silver Trout', value: 35 },
        { item: 'Golden Koi', value: 90 },
        { item: 'Message in a Bottle', value: 140 },
    ],
} as const;

export const blackMarketValues = new Map<string, number>([
    ...itemPools['scavenger-hunt'],
    ...itemPools.fishing,
].map(({ item, value }) => [item, value] as const));

export const cooldowns = new Map<string, number>();
export const cooldownMs = 60_000;

export const crops = new Map([
    ['Wheat Seed', { crop: 'Wheat', minutes: 2 }],
    ['Carrot Seed', { crop: 'Carrot', minutes: 3 }],
    ['Apple Seed', { crop: 'Apple', minutes: 5 }],
]);

export const recipes = {
    bread: { label: 'Bread', output: 'Bread', minutes: 1, ingredients: { Wheat: 2 } },
    soup: { label: 'Vegetable Soup', output: 'Vegetable Soup', minutes: 2, ingredients: { Wheat: 1, Carrot: 2 } },
    pie: { label: 'Apple Pie', output: 'Apple Pie', minutes: 3, ingredients: { Wheat: 1, Apple: 2 } },
} as const;

export async function ensureWallet(prisma: PrismaClient, userId: string, serverId: string, username: string, nickname: string | null) {
    await prisma.moneyUser.upsert({
        where: { id: userId },
        update: { username, nickname },
        create: { id: userId, username, nickname },
    });
    return prisma.moneyWallet.upsert({
        where: { userId_serverId: { userId, serverId } },
        update: {},
        create: { userId, serverId, wallet: 100 },
    });
}

export function randomItem(pool: readonly { item: string; value: number }[]) {
    return pool[Math.floor(Math.random() * pool.length)];
}

export async function awardItem(prisma: PrismaClient, userId: string, serverId: string, item: string, quantity = 1) {
    return prisma.economyItem.upsert({
        where: { userId_serverId_item: { userId, serverId, item } },
        update: { quantity: { increment: quantity } },
        create: { id: inventoryId(userId, serverId, item), userId, serverId, item, quantity },
    });
}

export function checkCooldown(userId: string, serverId: string, game: string) {
    const key = `${userId}:${serverId}:${game}`;
    const lastPlayed = cooldowns.get(key) ?? 0;
    const remaining = cooldownMs - (Date.now() - lastPlayed);
    if (remaining > 0) return Math.ceil(remaining / 1000);
    cooldowns.set(key, Date.now());
    return 0;
}

export function farmId(userId: string, serverId: string) {
    return `${userId}-${serverId}`;
}

export const playableGames = ['heist', 'scavenger-hunt', 'fishing', 'farming'] as const;
export type PlayableGame = typeof playableGames[number];

export function sessionId(serverId: string, userId: string) {
    return `${serverId}-${userId}-${Date.now()}`;
}

export function isPlayableGame(value: string): value is PlayableGame {
    return playableGames.includes(value as PlayableGame);
}

export const farmSeedChoices = [
    { name: 'Wheat seed', value: 'Wheat Seed' },
    { name: 'Carrot seed', value: 'Carrot Seed' },
    { name: 'Apple seed', value: 'Apple Seed' },
];

export function farmButtons(userId: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`farm-status/${userId}`).setLabel('Farm status').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`farm-harvest/${userId}`).setLabel('Harvest crop').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`farm-craft/${userId}`).setLabel('Craft bread').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`farm-collect/${userId}`).setLabel('Collect bread').setStyle(ButtonStyle.Success),
    );
}

export function farmEmbed(title: string, description: string) {
    return new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x57f287);
}

export async function handleFarmInteraction(interaction: ButtonInteraction, prisma: PrismaClient) {
    const [action, userId] = interaction.customId.split('/');
    if (!userId || userId !== interaction.user.id || !interaction.guildId) return false;
    const serverId = interaction.guildId;
    const farm = await prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } });
    if (action === 'farm-status') {
        const job = await prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } });
        return void await interaction.update({ embeds: [farmEmbed('Farm status', `${farm ? `🌱 **${farm.crop}** is growing and will be ready <t:${Math.floor(farm.readyAt.getTime() / 1000)}:R>.` : 'Your plot is empty.'}\n${job ? `🍞 **${job.output}** will be ready <t:${Math.floor(job.readyAt.getTime() / 1000)}:R>.` : 'The kitchen is idle.'}`)], components: [farmButtons(userId)] });
    }
    if (action === 'farm-harvest') {
        if (!farm) return void await interaction.reply({ content: 'Your plot is empty.' });
        if (farm.readyAt.getTime() > Date.now()) return void await interaction.reply({ content: `Your **${farm.crop}** is still growing. It will be ready <t:${Math.floor(farm.readyAt.getTime() / 1000)}:R>.` });
        const quantity = Math.floor(Math.random() * 3) + 2;
        await prisma.$transaction(async transaction => {
            await transaction.economyFarmPlot.delete({ where: { id: farm.id } });
            await transaction.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: farm.crop } }, update: { quantity: { increment: quantity } }, create: { id: inventoryId(userId, serverId, farm.crop), userId, serverId, item: farm.crop, quantity } });
        });
        return void await interaction.update({ embeds: [farmEmbed('Harvest complete', `You collected **${quantity}x ${farm.crop}**. Start another crop whenever you are ready.`)], components: [farmButtons(userId)] });
    }
    if (action === 'farm-craft') {
        const recipe = recipes.bread;
        const existingJob = await prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } });
        if (existingJob) return void await interaction.reply({ content: existingJob.readyAt.getTime() > Date.now() ? `Your kitchen is making **${existingJob.output}**.` : `Use **Collect bread** to collect ${existingJob.quantity}x ${existingJob.output}.` });
        const ingredients = await prisma.economyItem.findMany({ where: { userId, serverId, item: { in: ['Wheat'] } } });
        if ((ingredients[0]?.quantity ?? 0) < 2) return void await interaction.reply({ content: 'You need **2x Wheat** to craft bread.', flags: MessageFlags.Ephemeral });
        const startedAt = new Date();
        const readyAt = new Date(startedAt.getTime() + recipe.minutes * 60_000);
        await prisma.$transaction([
            prisma.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: 'Wheat' } }, data: { quantity: { decrement: 2 } } }),
            prisma.economyCraftJob.create({ data: { id: farmId(userId, serverId), userId, serverId, recipe: 'bread', output: 'Bread', readyAt, startedAt, notificationChannelId: interaction.channelId, notificationMessageId: interaction.message.id } }),
        ]);
        return void await interaction.update({ embeds: [farmEmbed('Bread started', `Your kitchen is making **Bread**. It will be ready <t:${Math.floor(readyAt.getTime() / 1000)}:R>.`)], components: [farmButtons(userId)] });
    }
    if (action === 'farm-collect') {
        const existingJob = await prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } });
        if (!existingJob) return void await interaction.reply({ content: 'There is no bread ready to collect.' });
        if (existingJob.readyAt.getTime() > Date.now()) return void await interaction.reply({ content: `Your **${existingJob.output}** is still cooking. It will be ready <t:${Math.floor(existingJob.readyAt.getTime() / 1000)}:R>.` });
        await prisma.$transaction([
            prisma.economyCraftJob.delete({ where: { id: existingJob.id } }),
            prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: existingJob.output } }, update: { quantity: { increment: existingJob.quantity } }, create: { id: inventoryId(userId, serverId, existingJob.output), userId, serverId, item: existingJob.output, quantity: existingJob.quantity } }),
        ]);
        return void await interaction.update({ embeds: [farmEmbed('Bread collected', `You collected **${existingJob.quantity}x ${existingJob.output}**.`)], components: [farmButtons(userId)] });
    }
    return false;
}

export const recipeBoosts = {
    bread: { item: 'Bread', multiplier: 1.15, minutes: 30 },
    soup: { item: 'Vegetable Soup', multiplier: 1.3, minutes: 60 },
    pie: { item: 'Apple Pie', multiplier: 1.5, minutes: 90 },
} as const;

export async function getActiveEconomyBoost(prisma: PrismaClient, userId: string, serverId: string) {
    const boost = await prisma.economyBoost.findUnique({ where: { userId_serverId: { userId, serverId } } });
    if (!boost) return null;
    if (boost.expiresAt.getTime() <= Date.now()) {
        await prisma.economyBoost.delete({ where: { id: boost.id } });
        return null;
    }
    return boost;
}