import { checkEmojis, deleteOnTimeout, env, evaluateCountExpression, failEmojis, levelFromTotalXp, levelingWeekKey, raceCountMessages, randomCountMessage, randomMessage, resetCounter, repeatCountMessages, wrongCountMessages, xpCooldownMs, xpCooldowns, delay } from '#utils';
import { EventType, Service, eventModule } from '@sern/handler';
import { ChannelType, Events, TextChannel } from 'discord.js';

export default eventModule({
    type: EventType.Discord,
    name: Events.MessageCreate,
    execute: async message => {
        const prisma = Service('prisma');
        const msg = message.content.toLowerCase();
        const prefixRegex = new RegExp(`^(<@!?${message.client.user.id}>)\\s*`);

        if (prefixRegex.test(message.content)) {
            await message.delete();
            const stamp = `${message.client.readyTimestamp! / 1000}`;
            if (message.channel.isTextBased()) {
                const sent = await (message.channel as TextChannel).send(
                    `${message.member}, I have been online since <t:${parseInt(stamp)}:R>`
                );
                setTimeout(async () => {
                    await sent.delete();
                }, 10000);
            }
        }

        if (
            message.author.bot ||
            message.system ||
            message.channel.type === ChannelType.DM ||
            !message.guild ||
            !message.inGuild()
        )
            return null;

        const counter = await prisma.counter.findUnique({ where: { gID: message.guild.id } });
        if (counter?.active && counter.channel === message.channel.id) {
            const nextCount = counter.count + 1;
            const submittedCount = message.content.trim();
            const expression = submittedCount.match(/^\d[\d\s().+\-*/]*/)?.[0].trim();

            if (!expression) {
                await message.delete().catch(() => undefined);
                return null;
            }

            if (counter.lastUser === message.author.id) {
                await message.react(randomMessage(failEmojis)).catch(() => undefined);
                const reset = await resetCounter(prisma, message.guild.id, message.channel.id, counter.count);
                await message.channel.sendTyping().catch(() => undefined);
                await delay(5);
                const response = await message.reply(reset ? `${randomCountMessage(repeatCountMessages, { user: message.author.username })} You counted twice in a row, so the counter has reset. The next number is **1**.` : `${randomMessage(raceCountMessages)} The next number is **1**.`).catch(() => undefined);
                if (response) deleteOnTimeout(response, 10_000);
                return null;
            }
            if (evaluateCountExpression(expression) !== nextCount) {
                await message.react(randomMessage(failEmojis)).catch(() => undefined);
                const recordMessage = counter.recordPending && counter.lastUser !== message.author.id
                    ? ` 🏆 New server record: **${counter.highestCount}**!`
                    : '';
                const reset = await resetCounter(prisma, message.guild.id, message.channel.id, counter.count);
                await message.channel.sendTyping().catch(() => undefined);
                await delay(5);
                const response = await message.reply(reset ? `${randomCountMessage(wrongCountMessages, { expected: String(nextCount) })}${recordMessage} The counter has reset. The next number is **1**.` : `${randomMessage(raceCountMessages)} The next number is **1**.`).catch(() => undefined);
                if (response) deleteOnTimeout(response, 10_000);
                return null;
            }

            const reward = Math.floor(Math.random() * 100) + 1;
            const counted = await prisma.$transaction(async transaction => {
                const updated = await transaction.counter.updateMany({
                    where: {
                        gID: message.guild.id,
                        active: true,
                        channel: message.channel.id,
                        count: counter.count,
                        OR: [{ lastUser: null }, { lastUser: { not: message.author.id } }],
                    },
                    data: {
                        count: nextCount,
                        lastCount: nextCount,
                        lastUser: message.author.id,
                        highestCount: Math.max(counter.highestCount, nextCount),
                        recordPending: nextCount > counter.highestCount,
                    },
                });
                if (!updated.count) return false;
                await transaction.countingUser.upsert({
                    where: { id: `${message.guild.id}-${message.author.id}` },
                    update: { coins: { increment: reward }, counterId: message.guild.id },
                    create: { id: `${message.guild.id}-${message.author.id}`, coins: reward, counterId: message.guild.id },
                });
                return true;
            });
            if (!counted) {
                await message.channel.sendTyping().catch(() => undefined);
                await delay(3);
                const response = await message.reply(`${randomMessage(raceCountMessages)} Please try the next number.`).catch(() => undefined);
                if (response) deleteOnTimeout(response, 10_000);
            } else await message.react(nextCount === 100 ? '💯' : randomMessage(checkEmojis)).catch(() => undefined);
            return null;
        }

        await prisma.moneyUser.upsert({
            where: { id: message.author.id },
            update: { username: message.author.username, nickname: message.member?.nickname ?? null },
            create: { id: message.author.id, username: message.author.username, nickname: message.member?.nickname ?? null }
        });
        const profileData = await prisma.moneyWallet.upsert({
            where: { userId_serverId: { userId: message.author.id, serverId: message.guild.id } },
            update: {},
            create: { userId: message.author.id, serverId: message.guild.id, wallet: 100 }
        });
        try {
            if (!msg.startsWith(env.DEFAULT_PREFIX)) {
                const coinsToAdd = Math.floor(Math.random() * 50) + 1;
                await prisma.moneyWallet.update({
                    where: { userId_serverId: { userId: profileData.userId, serverId: profileData.serverId } },
                    data: {
                        wallet: { increment: coinsToAdd }
                    }
                });
            }
        } catch (error) {
            console.log(error);
        }

        if (!msg.startsWith(env.DEFAULT_PREFIX)) {
            const levelSettings = await prisma.levelSettings.findUnique({ where: { gID: message.guild.id } });
            if (levelSettings?.enabled) {
                const weekKey = levelingWeekKey();
                if (levelSettings.weeklyKey !== weekKey) {
                    await prisma.levelSettings.update({ where: { gID: message.guild.id }, data: { weeklyKey: weekKey } });
                    await prisma.levelUser.updateMany({ where: { serverId: message.guild.id }, data: { weeklyXp: 0 } });
                }
                const cooldownKey = `${message.author.id}:${message.guild.id}`;
                const lastXpAt = xpCooldowns.get(cooldownKey) ?? 0;
                if (Date.now() - lastXpAt >= xpCooldownMs) {
                    xpCooldowns.set(cooldownKey, Date.now());
                    const xpToAdd = Math.floor(Math.random() * 11) + 15;
                    const levelUser = await prisma.levelUser.upsert({
                        where: { userId_serverId: { userId: message.author.id, serverId: message.guild.id } },
                        update: { xp: { increment: xpToAdd }, weeklyXp: { increment: xpToAdd } },
                        create: { userId: message.author.id, serverId: message.guild.id, xp: xpToAdd, weeklyXp: xpToAdd },
                    });
                    const previousLevel = levelFromTotalXp(levelUser.xp - xpToAdd).level;
                    const currentLevel = levelFromTotalXp(levelUser.xp).level;
                    if (currentLevel > previousLevel && message.channel.isTextBased()) {
                        await (message.channel as TextChannel).send(`🎉 ${message.member ?? message.author}, you leveled up to **level ${currentLevel}**!`);
                    }
                }
            }
        }
    }
});