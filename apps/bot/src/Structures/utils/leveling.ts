import { createCanvas } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import type { PrismaClient } from '@orchard/database';
import { LevelUpBuilder, RankCardBuilder } from '@orchard/canvas';
import type { UserStatus } from '@orchard/canvas';

export const levelingMedals = ['🥇', '🥈', '🥉'];

const xpRequirementCache: number[] = [0, 1000];

export function xpRequiredForLevel(level: number): number {
    if (level < 1) return 0;
    while (xpRequirementCache.length <= level) {
        const previous = xpRequirementCache[xpRequirementCache.length - 1];
        xpRequirementCache.push(Math.ceil(previous * 1.25));
    }
    return xpRequirementCache[level];
}

export interface LevelProgress {
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
}

export function levelFromTotalXp(totalXp: number): LevelProgress {
    let level = 0;
    let remaining = totalXp;
    while (remaining >= xpRequiredForLevel(level + 1)) {
        remaining -= xpRequiredForLevel(level + 1);
        level++;
    }
    return { level, xpIntoLevel: remaining, xpForNextLevel: xpRequiredForLevel(level + 1) };
}

export function levelingWeekKey(date = new Date()) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
}

export async function getUserRank(prisma: PrismaClient, serverId: string, xp: number): Promise<number> {
    const higherCount = await prisma.levelUser.count({ where: { serverId, xp: { gt: xp } } });
    return higherCount + 1;
}

export async function buildRankCard(params: { username: string; avatarUrl: string; totalXp: number; rank: number; userStatus?: UserStatus }) {
    const progress = levelFromTotalXp(params.totalXp);
    const canvas = createCanvas(1000, 250);
    const context = canvas.getContext('2d');
    const card = new RankCardBuilder({
        nicknameText: { content: params.username },
        currentLvl: progress.level,
        currentRank: params.rank,
        currentXP: progress.xpIntoLevel,
        requiredXP: progress.xpForNextLevel,
        userStatus: params.userStatus ?? 'online',
        avatarImgURL: params.avatarUrl,
        backgroundColor: { background: '#20242c', bubbles: '#2f3542' },
        progressBarColor: '#57f287',
    });
    await card.draw(context, canvas.width, canvas.height);
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `rank-${params.username}.png` });
}

export async function buildLevelUpCard(params: { username: string; avatarUrl: string; previousLevel: number; newLevel: number; userStatus?: UserStatus }) {
    const canvas = createCanvas(1000, 250);
    const context = canvas.getContext('2d');
    const card = new LevelUpBuilder({
        nicknameText: { content: params.username },
        previousLvl: params.previousLevel,
        newLvl: params.newLevel,
        avatarImgURL: params.avatarUrl,
        userStatus: params.userStatus ?? 'online',
        backgroundColor: { background: '#20242c', pattern: 'stars', patternColor: '#57f287' },
    });
    await card.draw(context, canvas.width, canvas.height);
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `level-up-${params.username}.png` });
}

export async function resetWeeklyLeveling(prisma: PrismaClient, serverId: string) {
    const settings = await prisma.levelSettings.findUnique({ where: { gID: serverId } });
    const weekKey = levelingWeekKey();
    if (settings && settings.weeklyKey !== weekKey) {
        await prisma.levelSettings.update({ where: { gID: serverId }, data: { weeklyKey: weekKey } });
        await prisma.levelUser.updateMany({ where: { serverId }, data: { weeklyXp: 0 } });
        settings.weeklyKey = weekKey;
    }
    return settings;
}

export async function settleWeeklyLeveling(prisma: PrismaClient, serverId: string, settings: NonNullable<Awaited<ReturnType<typeof resetWeeklyLeveling>>>, top: Array<{ userId: string; weeklyXp: number }>) {
    const xpRewards = [settings.firstReward, settings.secondReward, settings.thirdReward];
    await prisma.$transaction(async transaction => {
        for (let index = 0; index < top.length; index++) {
            const place = index + 1;
            const coins = settings.participantReward;
            const xp = xpRewards[index] ?? 0;
            const existing = await transaction.levelWeeklyReward.findUnique({ where: { serverId_weekKey_userId: { serverId, weekKey: settings.weeklyKey, userId: top[index].userId } } });
            if (existing) continue;
            await transaction.levelWeeklyReward.create({ data: { id: `${serverId}-${settings.weeklyKey}-${top[index].userId}`, serverId, weekKey: settings.weeklyKey, userId: top[index].userId, place, amount: coins } });
            await transaction.moneyWallet.upsert({ where: { userId_serverId: { userId: top[index].userId, serverId } }, update: { wallet: { increment: coins } }, create: { userId: top[index].userId, serverId, wallet: coins } });
            if (xp) await transaction.levelUser.update({ where: { userId_serverId: { userId: top[index].userId, serverId } }, data: { xp: { increment: xp } } });
        }
    });
}
