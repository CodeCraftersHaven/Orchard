import { Init } from "@sern/handler";
import { PrismaClient } from '@orchard/database'
import { BaseGuildTextChannel, ContainerBuilder, EmbedBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder, type MessageCreateOptions } from "discord.js";

export type StickyContent = {
    channelId: string;
    mode: 'Text' | 'Embed' | 'Container';
    content: string;
    title: string;
    description: string;
    color: string;
};

function isUniqueConstraintError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export class Sticky implements Init {
    private db: PrismaClient
    private deps: Dependencies
    private messageCounts = new Map<string, number>()

    constructor(deps: Dependencies) {
        this.deps = deps;
        this.db = this.deps.prisma;
    }

    private render(sticky: { mode: string; content: string; title: string; description: string; color: string }): MessageCreateOptions {
        const color = /^#[0-9A-Fa-f]{6}$/.test(sticky.color) ? Number.parseInt(sticky.color.slice(1), 16) : 0x5865f2;
        if (sticky.mode === 'Embed') {
            const embed = new EmbedBuilder().setColor(color);
            if (sticky.title) embed.setTitle(sticky.title);
            if (sticky.description || sticky.content) embed.setDescription(sticky.description || sticky.content);
            return { embeds: [embed] };
        }
        if (sticky.mode === 'Container') {
            return {
                components: [new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${sticky.title || 'Sticky Message'}**`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(sticky.content))],
                flags: MessageFlags.IsComponentsV2,
            };
        }
        return { content: sticky.content };
    }

    async list(guildId: string) {
        return this.db.sticky.findMany({ where: { stickySettingsGuildId: guildId }, orderBy: { id: 'asc' } });
    }

    async create(guildId: string, channelId: string, content: Omit<StickyContent, 'channelId'>) {
        const data: StickyContent = { ...content, channelId };
        const existing = await this.db.sticky.findFirst({ where: { stickySettingsGuildId: guildId, channelId } });
        if (existing) throw new Error('CHANNEL_STICKY_EXISTS');
        const guild = await this.deps['@sern/client'].guilds.fetch(guildId);
        const channel = await guild.channels.fetch(data.channelId);
        if (!(channel instanceof BaseGuildTextChannel)) throw new Error('Choose a text channel in this server.');

        await this.db.stickySettings.upsert({
            where: { guildId },
            update: { enabled: true },
            create: { guildId, enabled: true, logsChannelId: '' },
        });
        const message = await channel.send(this.render(data));
        try {
            return await this.db.sticky.create({ data: { ...data, messageId: message.id, stickySettingsGuildId: guildId } });
        } catch (error) {
            await message.delete().catch(() => undefined);
            if (isUniqueConstraintError(error)) throw new Error('CHANNEL_STICKY_EXISTS');
            throw error;
        }
    }

    async update(guildId: string, stickyId: string, changes: Partial<StickyContent>) {
        const existing = await this.db.sticky.findFirst({ where: { id: stickyId, stickySettingsGuildId: guildId } });
        if (!existing) return null;

        const updated = { ...existing, ...changes };
        const channelSticky = await this.db.sticky.findFirst({
            where: { stickySettingsGuildId: guildId, channelId: updated.channelId, id: { not: stickyId } },
        });
        if (channelSticky) throw new Error('CHANNEL_STICKY_EXISTS');
        if ((updated.mode === 'Text' || updated.mode === 'Container') && !updated.content.trim()) throw new Error('This sticky format needs message content.');
        if (updated.mode === 'Text' && updated.content.length > 2000) throw new Error('Regular sticky messages cannot exceed 2,000 characters.');
        if (updated.mode === 'Embed' && !updated.title.trim() && !updated.description.trim() && !updated.content.trim()) throw new Error('An embed needs a title or description.');
        const guild = await this.deps['@sern/client'].guilds.fetch(guildId);
        const channel = await guild.channels.fetch(updated.channelId);
        if (!(channel instanceof BaseGuildTextChannel)) throw new Error('Choose a text channel in this server.');

        const message = await channel.send(this.render(updated));
        try {
            const saved = await this.db.sticky.update({ where: { id: stickyId }, data: { ...changes, messageId: message.id } });
            const oldChannel = await guild.channels.fetch(existing.channelId).catch(() => null);
            if (oldChannel instanceof BaseGuildTextChannel && existing.messageId) await oldChannel.messages.delete(existing.messageId).catch(() => undefined);
            return saved;
        } catch (error) {
            await message.delete().catch(() => undefined);
            if (isUniqueConstraintError(error)) throw new Error('CHANNEL_STICKY_EXISTS');
            throw error;
        }
    }

    async delete(guildId: string, stickyId: string) {
        const existing = await this.db.sticky.findFirst({ where: { id: stickyId, stickySettingsGuildId: guildId } });
        if (!existing) return false;
        const guild = await this.deps['@sern/client'].guilds.fetch(guildId).catch(() => null);
        const channel = guild ? await guild.channels.fetch(existing.channelId).catch(() => null) : null;
        if (channel instanceof BaseGuildTextChannel && existing.messageId) await channel.messages.delete(existing.messageId).catch(() => undefined);
        await this.db.sticky.delete({ where: { id: stickyId } });
        return true;
    }

    async init() {
        const stickSettings = await this.db.stickySettings.findMany({ include: { stickies: true } })
        for (const set of stickSettings) {
            let guild;
            try {
                guild = await this.deps['@sern/client'].guilds.fetch(set.guildId);
            } catch (error) {
                console.error(`Failed to load sticky guild ${set.guildId}`, error);
                continue;
            }
            for (const sticky of set.stickies) {
                let messageExists = false;
                try {
                    const channel = await guild.channels.fetch(sticky.channelId);
                    if (channel instanceof BaseGuildTextChannel && sticky.messageId) {
                        await channel.messages.fetch(sticky.messageId);
                        messageExists = true;
                    }
                } catch {
                    messageExists = false;
                }

                if (messageExists) continue;
                const logChannel = set.logsChannelId ? await guild.channels.fetch(set.logsChannelId).catch(() => null) : null;
                if (logChannel instanceof BaseGuildTextChannel) {
                    await logChannel.send(`Sticky message ${sticky.id} in <#${sticky.channelId}> could not be found. It has been removed from the sticky list.`).catch(error => console.error('Failed to send sticky startup notice', error));
                } else {
                    console.warn(`Sticky message ${sticky.id} in guild ${set.guildId} could not be found; no valid log channel is configured.`);
                }
                await this.db.sticky.delete({ where: { id: sticky.id } });
            }
        }
    }

    async handleMessage(guildId: string, channelId: string) {
        const stickies = await this.db.sticky.findMany({
            where: { stickySettingsGuildId: guildId, channelId, stickySettings: { enabled: true } },
        });
        if (!stickies.length) return;

        const key = `${guildId}:${channelId}`;
        const nextCount = (this.messageCounts.get(key) ?? 0) + 1;
        if (nextCount < 5) {
            this.messageCounts.set(key, nextCount);
            return;
        }
        this.messageCounts.set(key, 0);

        const channel = await this.deps['@sern/client'].channels.fetch(channelId);
        if (!(channel instanceof BaseGuildTextChannel)) return;
        for (const sticky of stickies) {
            try {
                if (sticky.messageId) await channel.messages.delete(sticky.messageId).catch(() => undefined);
                const message = await channel.send(this.render(sticky));
                await this.db.sticky.update({ where: { id: sticky.id }, data: { messageId: message.id } });
            } catch (error) {
                console.error(`Failed to repost sticky ${sticky.id} in guild ${guildId}`, error);
            }
        }
    }
}