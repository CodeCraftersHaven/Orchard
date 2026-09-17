import { commandModule, CommandType } from '@sern/handler';
import { publishConfig, IntegrationContextType } from '#plugins';
import { ApplicationCommandOptionType } from 'discord.js';
import { awardItem, checkCooldown, crops, economyLabels, economyResponse, ensureItemDefinitions, ensureWallet, farmButtons, farmEmbed, farmId, farmSeedChoices, getActiveEconomyBoost, inventoryId, isPlayableGame, randomItem, recipes, sessionId } from '#utils';

export default commandModule({
    type: CommandType.Slash,
    description: 'Play games and earn economy rewards.',
    plugins: [publishConfig({ contexts: [IntegrationContextType.GUILD], integrationTypes: ['Guild'] })],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'session-start',
            description: 'Start a timed multiplayer game session.',
            options: [
                { type: ApplicationCommandOptionType.String, name: 'game', description: 'Game to play.', required: true, choices: [{ name: 'Heist', value: 'heist' }, { name: 'Scavenger hunt', value: 'scavenger-hunt' }, { name: 'Fishing', value: 'fishing' }, { name: 'Farming', value: 'farming' }] },
                { type: ApplicationCommandOptionType.Boolean, name: 'open-invites', description: 'Allow online server members to join.', required: false },
            ],
        },
        { type: ApplicationCommandOptionType.Subcommand, name: 'session-join', description: 'Join an open or invited game session.', options: [{ type: ApplicationCommandOptionType.String, name: 'session-id', description: 'Session ID.', required: true }] },
        { type: ApplicationCommandOptionType.Subcommand, name: 'session-finish', description: 'Collect rewards from a completed game session.', options: [{ type: ApplicationCommandOptionType.String, name: 'session-id', description: 'Session ID.', required: true }] },
        { type: ApplicationCommandOptionType.Subcommand, name: 'scavenger-hunt', description: 'Search for a sellable item.' },
        { type: ApplicationCommandOptionType.Subcommand, name: 'fishing', description: 'Go fishing for a sellable item.' },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'farm',
            description: 'Start a crop and manage your farm from one message.',
            options: [{ type: ApplicationCommandOptionType.String, name: 'item', description: 'Seed to plant.', required: true, choices: farmSeedChoices }],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'sell',
            description: 'Sell an item to the black market.',
            options: [
                { type: ApplicationCommandOptionType.String, name: 'item', description: 'Item name.', required: true, autocomplete: true },
                { type: ApplicationCommandOptionType.Integer, name: 'quantity', description: 'Number of items to sell.', required: false, min_value: 1 },
            ],
        },
    ],
    async execute(ctx, { deps }) {
        if (!ctx.inGuild || !ctx.guildId) return ctx.reply(economyResponse('This command can only be used in a server.', 'Game unavailable'));
        const prisma = deps.prisma;
        const userId = ctx.user.id;
        const serverId = ctx.guildId;
        const { currencyName, bankName } = await economyLabels(deps.prisma, serverId);
        const nickname = ctx.member && 'nickname' in ctx.member ? ctx.member.nickname : null;
        const subcommand = ctx.options.getSubcommand(true);
        const guild = await prisma.guild.findUnique({ where: { gID: serverId }, select: { gamingChannelId: true } });
        if (guild?.gamingChannelId && ctx.channelId !== guild.gamingChannelId) {
            return ctx.reply(economyResponse(`You can only use game commands in <#${guild.gamingChannelId}>.`, 'Wrong channel'));
        }
        const definitions = await ensureItemDefinitions(prisma, serverId);
        const wallet = await ensureWallet(prisma, userId, serverId, ctx.user.username, nickname ?? null);
        if (wallet.wallet <= 0) return ctx.reply(economyResponse(`You need ${currencyName.toLowerCase()} in your server wallet to participate in economy games. Your ${bankName.toLowerCase()} balance does not count here.`, 'Game unavailable'));
        const boost = await getActiveEconomyBoost(prisma, userId, serverId);
        const multiplier = boost?.multiplier ?? 1;

        if (subcommand === 'farm') {
            const seed = ctx.options.getString('item', true);
            const crop = crops.get(seed);
            if (!crop) return ctx.reply(economyResponse('That seed cannot be planted.', 'Farm unavailable'));
            const existingPlot = await prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } });
            if (existingPlot) return ctx.reply(economyResponse(`Your plot already has **${existingPlot.crop}** growing.`, 'Farm already started'));
            const seedItem = await prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId, serverId, item: seed } } });
            if (!seedItem || seedItem.quantity < 1) return ctx.reply(economyResponse(`You need a **${seed}** in your inventory first.`, 'Seed unavailable'));
            const plantedAt = new Date();
            const readyAt = new Date(plantedAt.getTime() + (crop.minutes * 60_000) / multiplier);
            await prisma.$transaction([
                prisma.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: seed } }, data: { quantity: { decrement: 1 } } }),
                prisma.economyFarmPlot.create({ data: { id: farmId(userId, serverId), userId, serverId, seed, crop: crop.crop, plantedAt, readyAt } }),
            ]);
            const response = await ctx.reply({ embeds: [farmEmbed('🌱 Crop started', `You planted **${seed}**. Your **${crop.crop}** will be ready <t:${Math.floor(readyAt.getTime() / 1000)}:R>.\n\nUse the buttons below to check the farm, harvest the crop, craft bread, or collect finished bread.`)], components: [farmButtons(userId)] });
            await prisma.economyFarmPlot.update({ where: { id: farmId(userId, serverId) }, data: { notificationChannelId: response.channelId, notificationMessageId: response.id } });
            return response;
        }

        if (subcommand === 'farm-buy-seed') {
            const seed = ctx.options.getString('seed', true);
            const prices: Record<string, number> = { 'Wheat Seed': 20, 'Carrot Seed': 30, 'Apple Seed': 45 };
            const price = prices[seed];
            if (!price) return ctx.reply(economyResponse('That seed is unavailable.', 'Seed unavailable'));
            if (wallet.wallet < price) return ctx.reply(economyResponse(`You need **${price} ${currencyName}** in your wallet to buy that seed.`, 'Insufficient funds'));
            await prisma.$transaction([
                prisma.moneyWallet.update({ where: { userId_serverId: { userId, serverId } }, data: { wallet: { decrement: price } } }),
                prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: seed } }, update: { quantity: { increment: 1 } }, create: { id: inventoryId(userId, serverId, seed), userId, serverId, item: seed, quantity: 1 } }),
            ]);
            return ctx.reply(economyResponse(`You bought **1x ${seed}** for **${price} ${currencyName}**.`, 'Seed purchased'));
        }

        if (subcommand === 'session-start' || subcommand === 'heist') {
            const game = subcommand === 'heist' ? 'heist' : ctx.options.getString('game', true);
            if (!isPlayableGame(game)) return ctx.reply(economyResponse('That game is unavailable.', 'Game unavailable'));
            const invites = ['invite-1', 'invite-2', 'invite-3'].map(name => ctx.options.getUser(name)).filter((user): user is NonNullable<typeof user> => Boolean(user && !user.bot && user.id !== userId));
            const openInvites = ctx.options.getBoolean('open-invites') ?? false;
            const existing = await prisma.economyGameSession.findFirst({ where: { serverId, leaderId: userId, status: 'active' } });
            if (existing) return ctx.reply(economyResponse(`You already have an active session: **${existing.id}**.`, 'Session already active'));
            const startedAt = new Date();
            const soloMinutes = game === 'heist' ? 30 : 5;
            const groupMinutes = game === 'heist' ? 10 : 3;
            const participants = [...new Set([userId, ...invites.map(user => user.id)])];
            const readyAt = new Date(startedAt.getTime() + (participants.length > 1 ? groupMinutes : soloMinutes) * 60_000);
            const created = await prisma.economyGameSession.create({ data: { id: sessionId(serverId, userId), serverId, game, leaderId: userId, invitesOpen: openInvites, startedAt, readyAt, participants: { create: participants.map(participantId => ({ userId: participantId })) } } });
            return ctx.reply(economyResponse(`Started a **${game}** session **${created.id}**. It will be ready <t:${Math.floor(readyAt.getTime() / 1000)}:R>. ${openInvites ? 'Online members may join.' : invites.length ? 'Invited players may join.' : 'You are playing solo.'}`, 'Game session started'));
        }

        if (subcommand === 'session-join') {
            const id = ctx.options.getString('session-id', true);
            const session = await prisma.economyGameSession.findUnique({ where: { id }, include: { participants: true } });
            if (!session || session.serverId !== serverId || session.status !== 'active') return ctx.reply(economyResponse('That session is unavailable.', 'Session unavailable'));
            const invited = session.participants.some(participant => participant.userId === userId);
            const online = ctx.guild?.members.cache.get(userId)?.presence?.status !== 'offline';
            if (!invited && !(session.invitesOpen && online)) return ctx.reply(economyResponse('You are not invited to that session, or it is not open to online members.', 'Cannot join session'));
            if (!invited) await prisma.economyGameParticipant.create({ data: { sessionId: session.id, userId } });
            if (session.game === 'heist' && session.participants.length === 1) await prisma.economyGameSession.update({ where: { id: session.id }, data: { readyAt: new Date(Date.now() + 10 * 60_000) } });
            return ctx.reply(economyResponse(`You joined **${session.game}** session **${session.id}**.`, 'Session joined'));
        }

        if (subcommand === 'session-finish') {
            const id = ctx.options.getString('session-id', true);
            const session = await prisma.economyGameSession.findUnique({ where: { id }, include: { participants: true } });
            if (!session || session.serverId !== serverId || !session.participants.some(participant => participant.userId === userId)) return ctx.reply(economyResponse('That session is unavailable or you are not a participant.', 'Cannot finish session'));
            if (session.readyAt.getTime() > Date.now()) return ctx.reply(economyResponse(`The session is still in progress. It will be ready <t:${Math.floor(session.readyAt.getTime() / 1000)}:R>.`, 'Session in progress'));
            if (session.status !== 'active') return ctx.reply(economyResponse('That session has already been collected.', 'Session collected'));
            const participants = session.participants.length;
            const rewardItem = session.game === 'heist' ? 'Heist Loot' : session.game === 'farming' ? 'Wheat Seed' : session.game === 'fishing' ? 'Silver Trout' : 'Old Coin';
            const quantity = Math.max(1, Math.floor((participants * (Math.random() * 2 + 1)) * multiplier));
            await prisma.$transaction(async transaction => {
                await transaction.economyGameSession.update({ where: { id: session.id }, data: { status: 'completed' } });
                for (const participant of session.participants) {
                    await transaction.economyItem.upsert({ where: { userId_serverId_item: { userId: participant.userId, serverId, item: rewardItem } }, update: { quantity: { increment: quantity } }, create: { id: inventoryId(participant.userId, serverId, rewardItem), userId: participant.userId, serverId, item: rewardItem, quantity } });
                }
            });
            return ctx.reply(economyResponse(`Session complete. Each of the **${participants}** participants received **${quantity}x ${rewardItem}** in their inventory.`, 'Session complete'));
        }

        if (subcommand === 'scavenger-hunt' || subcommand === 'fishing') {
            const wait = checkCooldown(userId, serverId, subcommand);
            if (wait) return ctx.reply(economyResponse(`You need a little more time. Try again in ${wait}s.`, 'Activity cooldown'));
            const pool = definitions.filter(definition => definition.game === subcommand);
            const item = randomItem(pool);
            const quantity = Math.max(1, Math.floor(Math.random() * 2 * multiplier) + 1);
            await awardItem(prisma, userId, serverId, item.item, quantity);
            return ctx.reply(economyResponse(`You found **${quantity}x ${item.item}**. The black market currently pays about **${item.value} ${currencyName}** each.`, 'Item found'));
        }

        if (subcommand === 'farm-plant') {
            const seed = ctx.options.getString('seed', true);
            const crop = crops.get(seed);
            if (!crop) return ctx.reply(economyResponse('That seed cannot be planted.', 'Planting unavailable'));
            const existingPlot = await prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } });
            if (existingPlot) return ctx.reply(economyResponse(`Your plot already has **${existingPlot.crop}** growing. Check back later or harvest it first.`, 'Plot occupied'));
            const seedItem = await prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId, serverId, item: seed } } });
            if (!seedItem || seedItem.quantity < 1) return ctx.reply(economyResponse(`You need a **${seed}** in your inventory first.`, 'Seed unavailable'));
            const plantedAt = new Date();
            const readyAt = new Date(plantedAt.getTime() + (crop.minutes * 60_000) / multiplier);
            await prisma.$transaction([
                prisma.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: seed } }, data: { quantity: { decrement: 1 } } }),
                prisma.economyFarmPlot.create({ data: { id: farmId(userId, serverId), userId, serverId, seed, crop: crop.crop, plantedAt, readyAt } }),
            ]);
            return ctx.reply(economyResponse(`You planted **${seed}**. Your **${crop.crop}** will be ready <t:${Math.floor(readyAt.getTime() / 1000)}:R>.`, 'Crop planted'));
        }

        if (subcommand === 'farm-status') {
            const [plot, job] = await Promise.all([
                prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } }),
                prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } }),
            ]);
            const lines = [plot ? `Plot: **${plot.crop}** ready <t:${Math.floor(plot.readyAt.getTime() / 1000)}:R>` : 'Plot: empty', job ? `Kitchen: **${job.output}** ready <t:${Math.floor(job.readyAt.getTime() / 1000)}:R>` : 'Kitchen: idle'];
            return ctx.reply(economyResponse(lines.join('\n'), 'Farm status'));
        }

        if (subcommand === 'farm-harvest') {
            const plot = await prisma.economyFarmPlot.findUnique({ where: { userId_serverId: { userId, serverId } } });
            if (!plot) return ctx.reply(economyResponse('Your plot is empty.', 'Harvest unavailable'));
            if (plot.readyAt.getTime() > Date.now()) return ctx.reply(economyResponse(`Your **${plot.crop}** is still growing. It will be ready <t:${Math.floor(plot.readyAt.getTime() / 1000)}:R>.`, 'Crop still growing'));
            const quantity = Math.max(2, Math.floor((Math.floor(Math.random() * 3) + 2) * multiplier));
            await prisma.$transaction(async transaction => {
                await transaction.economyFarmPlot.delete({ where: { id: plot.id } });
                await transaction.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: plot.crop } }, update: { quantity: { increment: quantity } }, create: { id: inventoryId(userId, serverId, plot.crop), userId, serverId, item: plot.crop, quantity } });
            });
            return ctx.reply(economyResponse(`Harvest complete. You collected **${quantity}x ${plot.crop}**.`, 'Harvest complete'));
        }

        if (subcommand === 'farm-craft') {
            const recipeKey = ctx.options.getString('recipe', true) as keyof typeof recipes;
            const recipe = recipes[recipeKey];
            const existingJob = await prisma.economyCraftJob.findUnique({ where: { userId_serverId: { userId, serverId } } });
            if (existingJob) {
                if (existingJob.readyAt.getTime() > Date.now()) return ctx.reply(economyResponse(`Your kitchen is making **${existingJob.output}**. It will be ready <t:${Math.floor(existingJob.readyAt.getTime() / 1000)}:R>.`, 'Kitchen in progress'));
                await prisma.$transaction([
                    prisma.economyCraftJob.delete({ where: { id: existingJob.id } }),
                    prisma.economyItem.upsert({ where: { userId_serverId_item: { userId, serverId, item: existingJob.output } }, update: { quantity: { increment: existingJob.quantity } }, create: { id: inventoryId(userId, serverId, existingJob.output), userId, serverId, item: existingJob.output, quantity: existingJob.quantity } }),
                ]);
                return ctx.reply(economyResponse(`You collected **${existingJob.quantity}x ${existingJob.output}** from the kitchen.`, 'Meal collected'));
            }
            const ingredients = await Promise.all(Object.entries(recipe.ingredients).map(async ([item, quantity]) => ({ item, quantity, inventory: await prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId, serverId, item } } }) })));
            if (ingredients.some(entry => !entry.inventory || entry.inventory.quantity < entry.quantity)) return ctx.reply(economyResponse(`You need ${Object.entries(recipe.ingredients).map(([item, quantity]) => `${quantity}x ${item}`).join(', ')}.`, 'Missing ingredients'));
            const startedAt = new Date();
            const readyAt = new Date(startedAt.getTime() + (recipe.minutes * 60_000) / multiplier);
            await prisma.$transaction([
                ...ingredients.map(entry => prisma.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: entry.item } }, data: { quantity: { decrement: entry.quantity } } })),
                prisma.economyCraftJob.create({ data: { id: farmId(userId, serverId), userId, serverId, recipe: recipeKey, output: recipe.output, readyAt, startedAt } }),
            ]);
            return ctx.reply(economyResponse(`You started making **${recipe.label}**. It will be ready <t:${Math.floor(readyAt.getTime() / 1000)}:R>.`, 'Crafting started'));
        }

        if (subcommand === 'sell') {
            const itemName = ctx.options.getString('item', true);
            const item = await prisma.economyItem.findUnique({ where: { userId_serverId_item: { userId, serverId, item: itemName } } });
            const marketValue = definitions.find(definition => definition.item.toLowerCase() === itemName.toLowerCase())?.value;
            const quantity = ctx.options.getInteger('quantity') ?? 1;
            if (!item || item.quantity < quantity || !marketValue) return ctx.reply(economyResponse('You do not have enough of that item, or it is not accepted by the black market.', 'Sale unavailable'));
            const total = marketValue * quantity;
            await prisma.$transaction([
                prisma.economyItem.update({ where: { userId_serverId_item: { userId, serverId, item: itemName } }, data: { quantity: { decrement: quantity } } }),
                prisma.moneyWallet.update({ where: { userId_serverId: { userId, serverId } }, data: { wallet: { increment: total } } }),
            ]);
            return ctx.reply(economyResponse(`The black market bought **${quantity}x ${itemName}** for **${total} ${currencyName}**.`, 'Sale complete'));
        }

    },
});
