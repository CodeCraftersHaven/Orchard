import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, ContainerBuilder, MessageFlags, PermissionFlagsBits, PermissionsBitField, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import { publishConfig, IntegrationContextType } from '#plugins';
import { buildWalletContainer } from '../Structures/utils/wallet.js';
import { categoryLabel, economyLabels, economyReply, economyResponse, ensureItemDefinitions, inventoryId, isAdministrator, isItemManagement, itemCatalogContainer, itemDefinitionId, itemEmoji, marketPrice, } from '#utils';



export default commandModule({
    type: CommandType.Slash,
    description: 'Manage your wallet, inventory, and player shop.',
    plugins: [publishConfig({ contexts: [IntegrationContextType.GUILD], integrationTypes: ['Guild'] })],
    options: [
        { type: ApplicationCommandOptionType.Subcommand, name: 'wallet', description: 'View your bank, wallet, inventory, and activity.' },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'buy-seed',
            description: 'Buy a seed for your farm.',
            options: [{ type: ApplicationCommandOptionType.String, name: 'seed', description: 'Seed to buy.', required: true, choices: [{ name: 'Wheat seed · 20 coins', value: 'Wheat Seed' }, { name: 'Carrot seed · 30 coins', value: 'Carrot Seed' }, { name: 'Apple seed · 45 coins', value: 'Apple Seed' }] }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'shop-list',
            description: 'List one of your items in the player shop.',
            options: [
                { type: ApplicationCommandOptionType.String, name: 'item', description: 'Item name.', required: true, autocomplete: true,
                    command: {
                        onEvent: [],
                        async execute(ctx, { deps }) {
                            if (!ctx.inGuild || !ctx.guildId) return ctx.respond([]);
                            const focused = ctx.options.getFocused().toLowerCase();
                            const items = await deps.prisma.economyItem.findMany({
                                where: { userId: ctx.user.id, serverId: ctx.guildId, quantity: { gt: 0 } },
                                orderBy: { item: 'asc' },
                            });
                            await ctx.respond(items
                                .filter(item => item.item.toLowerCase().startsWith(focused))
                                .slice(0, 25)
                                .map(item => ({ name: `${item.item} (${item.quantity})`, value: item.item })));
                        },
                    }
                 },
                { type: ApplicationCommandOptionType.Integer, name: 'quantity', description: 'Number of items to list.', required: true, min_value: 1 },
                { type: ApplicationCommandOptionType.Integer, name: 'price-each', description: 'Wallet coins per item.', required: true, min_value: 1 },
            ],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'shop-buy',
            description: 'Buy an item from another player.',
            options: [{
                type: ApplicationCommandOptionType.String,
                name: 'listing-id',
                description: 'Choose an item listing to buy.',
                required: true,
                autocomplete: true,
                command: {
                    onEvent: [],
                    async execute(ctx, { deps }) {
                        if (!ctx.inGuild || !ctx.guildId) return ctx.respond([]);
                        const focused = ctx.options.getFocused().toLowerCase();
                        const { currencyName } = await economyLabels(deps.prisma, ctx.guildId);
                        const listings = await deps.prisma.economyListing.findMany({
                            where: { serverId: ctx.guildId },
                            orderBy: { createdAt: 'asc' },
                        });
                        await ctx.respond(listings
                            .filter(listing => `${listing.item} ${listing.id}`.toLowerCase().includes(focused))
                            .slice(0, 25)
                            .map(listing => ({
                                name: `${listing.item} · ${listing.quantity}x · ${listing.priceEach} ${currencyName} each`,
                                value: listing.id,
                            })));
                    },
                },
            }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'shop-cancel',
            description: 'Cancel one of your player shop listings and reclaim the items.',
            options: [{
                type: ApplicationCommandOptionType.String,
                name: 'listing-id',
                description: 'Listing to cancel.',
                required: true,
                autocomplete: true,
                command: {
                    onEvent: [],
                    async execute(ctx, { deps }) {
                        if (!ctx.inGuild || !ctx.guildId) return ctx.respond([]);
                        const focused = ctx.options.getFocused().toLowerCase();
                        const { currencyName } = await economyLabels(deps.prisma, ctx.guildId);
                        const listings = await deps.prisma.economyListing.findMany({
                            where: { serverId: ctx.guildId, sellerId: ctx.user.id },
                            orderBy: { createdAt: 'asc' },
                        });
                        await ctx.respond(listings
                            .filter(listing => `${listing.item} ${listing.id}`.toLowerCase().includes(focused))
                            .slice(0, 25)
                            .map(listing => ({ name: `${listing.item} · ${listing.quantity}x · ${listing.priceEach} ${currencyName} each`, value: listing.id })));
                    },
                },
            }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'market-buy',
            description: 'Buy an item directly from the black market.',
            options: [{
                type: ApplicationCommandOptionType.String,
                name: 'item',
                description: 'Item to buy from the black market.',
                required: true,
                autocomplete: true,
                command: {
                    onEvent: [],
                    async execute(ctx, { deps }) {
                        if (!ctx.inGuild || !ctx.guildId) return ctx.respond([]);
                        const focused = ctx.options.getFocused().toLowerCase();
                        const { currencyName } = await economyLabels(deps.prisma, ctx.guildId);
                        const definitions = await ensureItemDefinitions(deps.prisma, ctx.guildId);
                        await ctx.respond(definitions.filter(item => item.item.toLowerCase().includes(focused)).slice(0, 25).map(item => ({ name: `${item.item} · ${marketPrice(item.item, item.value)} ${currencyName}`, value: item.item })));
                    },
                },
            }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'shop',
            description: 'Browse current player shop listings.',
            options: [{ type: ApplicationCommandOptionType.String, name: 'item', description: 'Filter by item name.', required: false }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'item-add',
            description: 'Admin: add an item to a game and set its black-market value.',
            options: [
                { type: ApplicationCommandOptionType.String, name: 'game', description: 'Game pool.', required: true, choices: [{ name: 'Scavenger hunt', value: 'scavenger-hunt' }, { name: 'Fishing', value: 'fishing' }, { name: 'Farming', value: 'farming' }] },
                { type: ApplicationCommandOptionType.String, name: 'item', description: 'Item name.', required: true },
                { type: ApplicationCommandOptionType.Integer, name: 'value', description: 'Black-market value.', required: true, min_value: 1 },
            ],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'item-edit',
            description: 'Admin: edit an item black-market value.',
            options: [
                { type: ApplicationCommandOptionType.String, name: 'item', description: 'Item name.', required: true },
                { type: ApplicationCommandOptionType.Integer, name: 'value', description: 'New black-market value.', required: true, min_value: 1 },
            ],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'item-remove',
            description: 'Admin: remove an item from the game catalog.',
            options: [{ type: ApplicationCommandOptionType.String, name: 'item', description: 'Item name.', required: true }],
        },
        { type: ApplicationCommandOptionType.Subcommand, name: 'item-list', description: 'Admin: list this server economy item catalog.' },
    ],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply(economyResponse('This command can only be used in a server.', 'Economy unavailable'));
        const prisma = deps.prisma;
        const userId = ctx.user.id;
        const serverId = ctx.guildId;
        const { currencyName } = await economyLabels(deps.prisma, serverId);
        const subcommand = ctx.options.getSubcommand(true);
        if (subcommand === 'wallet') return ctx.reply({ components: [await buildWalletContainer(prisma, { userId, username: ctx.user.username, serverId })], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        if (isItemManagement(subcommand) && !isAdministrator(ctx)) return ctx.reply(economyResponse('Administrator permissions are required for item management.', 'Permission required'));

        const definitions = subcommand === 'item-edit' || subcommand === 'item-remove'
            ? await prisma.economyItemDefinition.findMany({ where: { serverId }, orderBy: { item: 'asc' } })
            : await ensureItemDefinitions(prisma, serverId);
        if (subcommand === 'item-add') {
            const item = ctx.options.getString('item', true).trim();
            const game = ctx.options.getString('game', true);
            const value = ctx.options.getInteger('value', true);
            if (!item) return ctx.reply(economyResponse('Item name is required.', 'Invalid item'));
            await prisma.economyItemDefinition.upsert({ where: { serverId_item: { serverId, item } }, update: { game, value }, create: { id: itemDefinitionId(serverId, item), serverId, item, game, value } });
            return ctx.reply(economyReply('Item added', ['Item', 'Category', 'Value'], [[item, categoryLabel(game), `${value} ${currencyName}`]]));
        }
        if (subcommand === 'item-edit') {
            const item = ctx.options.getString('item', true);
            const value = ctx.options.getInteger('value', true);
            const definition = definitions.find(entry => entry.item.toLowerCase() === item.toLowerCase());
            if (!definition) return ctx.reply(economyResponse('That item does not exist in this server catalog.', 'Item not found'));
            await prisma.economyItemDefinition.update({ where: { id: definition.id }, data: { value } });
            return ctx.reply(economyReply('Item updated', ['Item', 'New value'], [[definition.item, `${value} ${currencyName}`]]));
        }
        if (subcommand === 'item-remove') {
            const item = ctx.options.getString('item', true);
            const definition = definitions.find(entry => entry.item.toLowerCase() === item.toLowerCase());
            if (!definition) return ctx.reply(economyResponse('That item does not exist in this server catalog.', 'Item not found'));
            await prisma.economyItemDefinition.delete({ where: { id: definition.id } });
            return ctx.reply(economyReply('Item removed', ['Item', 'Status'], [[definition.item, 'Removed from catalog']]));
        }
        if (subcommand === 'item-list') {
            return ctx.reply({ components: [itemCatalogContainer(definitions, currencyName)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (subcommand === 'shop-list') {
            const itemName = ctx.options.getString('item', true);
            const quantity = ctx.options.getInteger('quantity', true);
            const priceEach = ctx.options.getInteger('price-each', true);
            const item = await prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId, serverId, item: itemName } } });
            if (!item || item.quantity < quantity) return ctx.reply(economyResponse('You do not have enough of that item to create this listing.', 'Listing unavailable'));
            const listing = await prisma.$transaction(async transaction => {
                await transaction.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: itemName } }, data: { quantity: { decrement: quantity } } });
                return transaction.economyListing.create({ data: { id: `${serverId}-${userId}-${Date.now()}`, sellerId: userId, serverId, item: itemName, quantity, priceEach } });
            });
            return ctx.reply(economyReply('Shop listing created', ['Listing', 'Item', 'Quantity', 'Price'], [[listing.id, listing.item, `${listing.quantity}x`, `${listing.priceEach} ${currencyName} each`]]));
        }

        const wallet = await prisma.moneyWallet.findUnique({ where: { userId_serverId: { userId, serverId } } });
        if (!wallet) return ctx.reply(economyResponse(`You do not have a server wallet yet. Play a game first to start earning ${currencyName.toLowerCase()}.`, 'Wallet unavailable'));
        if (subcommand === 'buy-seed') {
            const seed = ctx.options.getString('seed', true);
            const prices: Record<string, number> = { 'Wheat Seed': 20, 'Carrot Seed': 30, 'Apple Seed': 45 };
            const price = prices[seed];
            if (!price) return ctx.reply(economyResponse('That seed is unavailable.', 'Seed unavailable'));
            if (wallet.wallet < price) return ctx.reply(economyResponse(`You need **${price} ${currencyName}** in your wallet to buy that seed.`, 'Insufficient funds'));
            await prisma.$transaction([
                prisma.moneyWallet.update({ where: { userId_serverId: { userId, serverId } }, data: { wallet: { decrement: price } } }),
                prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: seed } }, update: { quantity: { increment: 1 } }, create: { id: `${userId}-${serverId}-${seed.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`, userId, serverId, item: seed, quantity: 1 } }),
            ]);
            return ctx.reply(economyReply('Seed purchased', ['Seed', 'Cost'], [[seed, `${price} ${currencyName}`]]));
        }
        if (subcommand === 'market-buy') {
            const itemName = ctx.options.getString('item', true);
            const definition = definitions.find(item => item.item.toLowerCase() === itemName.toLowerCase());
            if (!definition) return ctx.reply(economyResponse('That item is not sold by the black market.', 'Item unavailable'));
            const price = marketPrice(definition.item, definition.value);
            if (wallet.wallet < price) return ctx.reply(economyResponse(`You need **${price} ${currencyName}** in your wallet to buy that item.`, 'Insufficient funds'));
            await prisma.$transaction([
                prisma.moneyWallet.update({ where: { userId_serverId: { userId, serverId } }, data: { wallet: { decrement: price } } }),
                prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: definition.item } }, update: { quantity: { increment: 1 } }, create: { id: inventoryId(userId, serverId, definition.item), userId, serverId, item: definition.item, quantity: 1 } }),
            ]);
            return ctx.reply(economyReply('Black-market purchase', ['Item', 'Price'], [[`${itemEmoji(definition.item, definition.game)} ${definition.item}`, `${price} ${currencyName}`]]));
        }
        if (subcommand === 'shop-buy') {
            const listingId = ctx.options.getString('listing-id', true);
            const listing = await prisma.economyListing.findUnique({ where: { id: listingId } });
            if (!listing || listing.serverId !== serverId || listing.sellerId === userId) return ctx.reply(economyResponse('That listing is unavailable.', 'Listing unavailable'));
            const total = listing.quantity * listing.priceEach;
            if (wallet.wallet < total) return ctx.reply(economyResponse(`You need **${total} ${currencyName}** in your wallet to buy this listing.`, 'Insufficient funds'));
            await prisma.$transaction([
                prisma.moneyWallet.update({ where: { userId_serverId: { userId, serverId } }, data: { wallet: { decrement: total } } }),
                prisma.moneyWallet.upsert({ where: { userId_serverId: { userId: listing.sellerId, serverId } }, update: { wallet: { increment: total } }, create: { userId: listing.sellerId, serverId, wallet: total } }),
                prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: listing.item } }, update: { quantity: { increment: listing.quantity } }, create: { id: inventoryId(userId, serverId, listing.item), userId, serverId, item: listing.item, quantity: listing.quantity } }),
                prisma.economyListing.delete({ where: { id: listing.id } }),
            ]);
            return ctx.reply(economyReply('Shop purchase complete', ['Item', 'Quantity', 'Total'], [[listing.item, `${listing.quantity}`, `${total} ${currencyName}`]]));
        }
        if (subcommand === 'shop-cancel') {
            const listingId = ctx.options.getString('listing-id', true);
            const listing = await prisma.economyListing.findUnique({ where: { id: listingId } });
            if (!listing || listing.serverId !== serverId || listing.sellerId !== userId) return ctx.reply(economyResponse('That listing is unavailable or does not belong to you.', 'Cannot cancel listing'));
            await prisma.$transaction([
                prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: listing.item } }, update: { quantity: { increment: listing.quantity } }, create: { id: inventoryId(userId, serverId, listing.item), userId, serverId, item: listing.item, quantity: listing.quantity } }),
                prisma.economyListing.delete({ where: { id: listing.id } }),
            ]);
            return ctx.reply(economyReply('Listing canceled', ['Item', 'Returned'], [[listing.item, `${listing.quantity}x returned to inventory`]]));
        }
        const filter = ctx.options.getString('item');
        const listings = await prisma.economyListing.findMany({ where: { serverId, ...(filter ? { item: filter } : {}) }, orderBy: { createdAt: 'asc' }, take: 20 });
        const marketItems = definitions.filter(definition => !filter || definition.item.toLowerCase().includes(filter.toLowerCase()));
        const categories = new Map<string, typeof listings>();
        for (const listing of listings) {
            const category = definitions.find(definition => definition.item.toLowerCase() === listing.item.toLowerCase())?.game ?? 'other';
            const categoryListings = categories.get(category) ?? [];
            categoryListings.push(listing);
            categories.set(category, categoryListings);
        }
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `## Economy shop${filter ? ` · ${filter}` : ''}`,
                'Buy from the black market with `/economy market-buy`, or buy player listings with `/economy shop-buy`.',
            ].join('\n')));
        container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent([
            '### 🏪 Black market',
            ...marketItems.map(item => `${itemEmoji(item.item, item.game)} **${item.item}** • **${marketPrice(item.item, item.value)} ${currencyName}** • /economy market-buy item:${item.item}`),
        ].join('\n')));
        if (!listings.length) {
            container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🧑‍🤝‍🧑 Player listings\nNo player listings match this filter.'));
            return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
        container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🧑‍🤝‍🧑 Player listings'));
        for (const [category, categoryListings] of categories) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `### ${categoryLabel(category)}`,
                ...categoryListings.map(listing => `🧾 **${listing.item}** • **${listing.quantity}x** • **${listing.priceEach} ${currencyName} each**\nListing: \`${listing.id}\` • Seller: <@${listing.sellerId}>`),
            ].join('\n')));
        }
        return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },
});
