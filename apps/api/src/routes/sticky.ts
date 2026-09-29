import type { FastifyInstance, FastifyReply } from "fastify";
import type { StickyMode } from "@orchard/types";
import { getBotGuildChannels, getBotGuildIds, getCurrentUserGuilds, hasAdministratorPermission, createBotStickyMessage, updateBotStickyMessage, deleteBotMessage } from "../lib/discord.js";

type Params = { guildId: string };
type StickyBody = {
    channelId: string;
    mode: StickyMode;
    content: string;
    title?: string;
    description?: string;
    color?: string;
};
type SettingsBody = { enabled: boolean; logsChannelId: string };
const modes: StickyMode[] = ["Text", "Embed", "Container"];
const stickyEmbedTitle = "Sticky Message";

async function requireAdministrator(fastify: FastifyInstance, request: { user: { accessToken: string }; params: Params }) {
    const guilds = await getCurrentUserGuilds(request.user.accessToken);
    const guild = guilds.find(entry => entry.id === request.params.guildId);
    if (!guild || !hasAdministratorPermission(guild)) throw new Error("FORBIDDEN");
    if (!(await getBotGuildIds()).has(request.params.guildId)) throw new Error("BOT_NOT_IN_GUILD");
}

async function textChannelExists(guildId: string, channelId: string) {
    const channels = await getBotGuildChannels(guildId);
    return channels.some(channel => channel.id === channelId && (channel.type === 0 || channel.type === 5));
}

function validSticky(body: StickyBody) {
    const content = body.content?.trim();
    const description = body.description?.trim() ?? "";
    const color = body.color ?? "#5865F2";
    if (!body.channelId || !modes.includes(body.mode) || !/^#[0-9A-Fa-f]{6}$/.test(color)) return null;
    if (body.mode === "Text" && (!content || content.length > 2000)) return null;
    if (body.mode === "Container" && (!content || content.length > 4000)) return null;
    if (body.mode === "Embed" && (!(description || content) || (description || content).length > 4096)) return null;
    return { channelId: body.channelId, mode: body.mode, content: content ?? "", title: body.mode === "Text" ? "" : stickyEmbedTitle, description, color };
}

function sendError(reply: FastifyReply, error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : "";
    const isUniqueConflict = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    const isChannelConflict = message === "CHANNEL_STICKY_EXISTS" || isUniqueConflict;
    const status = message === "FORBIDDEN" ? 403 : message === "BOT_NOT_IN_GUILD" || isChannelConflict ? 409 : 502;
    const text = message === "FORBIDDEN" ? "Administrator permissions are required." : message === "BOT_NOT_IN_GUILD" ? "The bot is not in this server." : isChannelConflict ? "This channel already has a sticky message." : fallback;
    return reply.code(status).send({ error: text });
}

export default async function stickyRoutes(fastify: FastifyInstance) {
    fastify.get<{ Params: Params }>("/:guildId/stickies", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const settings = await fastify.prisma.stickySettings.findUnique({ where: { guildId: request.params.guildId }, include: { stickies: { orderBy: { id: "asc" } } } });
            return { enabled: settings?.enabled ?? false, logsChannelId: settings?.logsChannelId ?? "", stickies: settings?.stickies ?? [] };
        } catch (error) {
            return sendError(reply, error, "Failed to load sticky messages.");
        }
    });

    fastify.put<{ Params: Params; Body: SettingsBody }>("/:guildId/stickies/settings", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const enabled = request.body?.enabled;
            const logsChannelId = request.body?.logsChannelId?.trim() ?? "";
            if (typeof enabled !== "boolean" || (enabled && !logsChannelId)) return reply.code(400).send({ error: "Choose a log channel before enabling stickies." });
            if (logsChannelId && !(await textChannelExists(request.params.guildId, logsChannelId))) return reply.code(400).send({ error: "Choose a text channel in this server for sticky logs." });
            return await fastify.prisma.stickySettings.upsert({
                where: { guildId: request.params.guildId },
                update: { enabled, logsChannelId },
                create: { guildId: request.params.guildId, enabled, logsChannelId },
            });
        } catch (error) {
            return sendError(reply, error, "Failed to save sticky settings.");
        }
    });

    fastify.post<{ Params: Params; Body: StickyBody }>("/:guildId/stickies", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const data = validSticky(request.body);
            if (!data) return reply.code(400).send({ error: "Enter valid sticky content, format, and color." });
            const settings = await fastify.prisma.stickySettings.findUnique({ where: { guildId: request.params.guildId } });
            if (!settings?.logsChannelId || !(await textChannelExists(request.params.guildId, data.channelId))) return reply.code(400).send({ error: "Choose a valid sticky channel and configure a log channel first." });
            const channelSticky = await fastify.prisma.sticky.findFirst({ where: { stickySettingsGuildId: request.params.guildId, channelId: data.channelId } });
            if (channelSticky) return reply.code(409).send({ error: "This channel already has a sticky message." });
            const message = await createBotStickyMessage(data.channelId, data);
            let sticky;
            try {
                sticky = await fastify.prisma.sticky.create({ data: { ...data, messageId: message.id, stickySettingsGuildId: request.params.guildId } });
            } catch (error) {
                await deleteBotMessage(data.channelId, message.id).catch(() => undefined);
                throw error;
            }
            await fastify.prisma.stickySettings.update({ where: { guildId: request.params.guildId }, data: { enabled: true } });
            return reply.code(201).send(sticky);
        } catch (error) {
            return sendError(reply, error, "Failed to create sticky message.");
        }
    });

    fastify.patch<{ Params: Params & { stickyId: string }; Body: StickyBody }>("/:guildId/stickies/:stickyId", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const data = validSticky(request.body);
            if (!data) return reply.code(400).send({ error: "Enter valid sticky content, format, and color." });
            if (!(await textChannelExists(request.params.guildId, data.channelId))) return reply.code(400).send({ error: "Choose a text channel in this server." });
            const existing = await fastify.prisma.sticky.findFirst({ where: { id: request.params.stickyId, stickySettingsGuildId: request.params.guildId } });
            if (!existing) return reply.code(404).send({ error: "Sticky message not found." });
            const channelSticky = await fastify.prisma.sticky.findFirst({ where: { stickySettingsGuildId: request.params.guildId, channelId: data.channelId, id: { not: existing.id } } });
            if (channelSticky) return reply.code(409).send({ error: "This channel already has a sticky message." });
            const message = await createBotStickyMessage(data.channelId, data);
            let updated;
            try {
                updated = await fastify.prisma.sticky.update({ where: { id: existing.id }, data: { ...data, messageId: message.id } });
            } catch (error) {
                await deleteBotMessage(data.channelId, message.id).catch(() => undefined);
                throw error;
            }
            await deleteBotMessage(existing.channelId, existing.messageId).catch(() => undefined);
            return updated;
        } catch (error) {
            return sendError(reply, error, "Failed to update sticky message.");
        }
    });

    fastify.delete<{ Params: Params & { stickyId: string } }>("/:guildId/stickies/:stickyId", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const existing = await fastify.prisma.sticky.findFirst({ where: { id: request.params.stickyId, stickySettingsGuildId: request.params.guildId } });
            if (!existing) return reply.code(404).send({ error: "Sticky message not found." });
            await deleteBotMessage(existing.channelId, existing.messageId).catch(() => undefined);
            await fastify.prisma.sticky.delete({ where: { id: existing.id } });
            return { deleted: true };
        } catch (error) {
            return sendError(reply, error, "Failed to delete sticky message.");
        }
    });
}
