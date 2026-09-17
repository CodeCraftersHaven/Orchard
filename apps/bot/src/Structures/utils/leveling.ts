import { createCanvas, loadImage } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import type { PrismaClient } from '@orchard/database';

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

export async function buildLevelCard(username: string, avatarUrl: string, totalXp: number) {
    const progress = levelFromTotalXp(totalXp);
    const canvas = createCanvas(1000, 280);
    const context = canvas.getContext('2d');
    context.fillStyle = '#20242c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const avatar = await loadImage(avatarUrl);
    context.save(); context.beginPath(); 
    context.arc(140, 140, 82, 0, Math.PI * 2); 
    context.clip(); context.drawImage(avatar, 58, 58, 164, 164); 
    context.restore();
    context.fillStyle = '#ffffff'; 
    context.font = 'bold 34px sans-serif'; 
    context.fillText(username, 270, 75);
    context.font = '24px sans-serif'; 
    context.fillStyle = '#b8c0cc'; 
    context.fillText(`Level ${progress.level}  •  ${totalXp.toLocaleString()} total XP`, 270, 115); 
    context.fillText(`${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNextLevel.toLocaleString()} XP to next level`, 270, 155);
    const barX = 270; const barY = 190; 
    const barWidth = 650; 
    const ratio = Math.min(1, progress.xpIntoLevel / progress.xpForNextLevel);
    context.fillStyle = '#11151b'; 
    context.roundRect(barX, barY, barWidth, 28, 14); 
    context.fill(); context.fillStyle = '#57f287'; 
    context.roundRect(barX, barY, Math.max(28, barWidth * ratio), 28, 14); 
    context.fill();
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `level-card-${username}.png` });
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
