import type { FastifyInstance } from "fastify";
import { addBotReaction, createBotEmbedMessage, deleteBotMessage, getBotGuildChannels, getBotGuildRoles, getBotGuildIds, getCurrentUserGuilds, hasAdministratorPermission } from "../lib/discord.js";

type ReactionEntryInput = { roleId: string; emoji: string };

export function normalizeReactionRoleRouteError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") return { status: 403, error: "Administrator permissions are required." };
    if (message === "MISSING_BOT") return { status: 409, error: "The bot is not in this server." };
    return { status: 502, error: fallback };
}

function nextId(existingIds: string[], prefix: string) {
    const next = existingIds
        .filter((id) => id.startsWith(`${prefix}+`))
        .map((id) => Number(id.slice(prefix.length + 1)))
        .filter(Number.isInteger)
        .reduce((highest, value) => Math.max(highest, value), 0) + 1;
    return `${prefix}+${String(next).padStart(3, "0")}`;
}

async function requireAdministrator(fastify: FastifyInstance, request: { user: { accessToken: string }; params: { guildId: string } }) {
    const guilds = await getCurrentUserGuilds(request.user.accessToken);
    const guild = guilds.find((entry) => entry.id === request.params.guildId);
    if (!guild || !hasAdministratorPermission(guild)) throw new Error("FORBIDDEN");
    if (!(await getBotGuildIds()).has(request.params.guildId)) throw new Error("MISSING_BOT");
    return guild;
}

export default async function reactionRoleRoutes(fastify: FastifyInstance) {
    fastify.get<{ Params: { guildId: string } }>('/:guildId/reaction-roles', { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const [panels, channels, roles] = await Promise.all([
                fastify.prisma.reactionRole.findMany({ where: { gID: request.params.guildId }, include: { roles: true }, orderBy: { id: "asc" } }),
                getBotGuildChannels(request.params.guildId).catch((error) => {
                    fastify.log.error({ err: error, guildId: request.params.guildId }, "Failed to load reaction-role channels.");
                    return [];
                }),
                getBotGuildRoles(request.params.guildId).catch((error) => {
                    fastify.log.error({ err: error, guildId: request.params.guildId }, "Failed to load reaction-role roles.");
                    return [];
                }),
            ]);
            return {
                panels: panels.map((panel) => ({ ...panel, entries: panel.roles.map((entry) => ({ ...entry, roleName: roles.find((role) => role.id === entry.roleId)?.name })) })),
                channels: channels.filter((channel) => channel.type === 0),
                roles: roles.filter((role) => !role.managed),
            };
        } catch (error) {
            const normalized = normalizeReactionRoleRouteError(error, "Failed to load reaction roles.");
            if (normalized.status >= 500) {
                fastify.log.error({ err: error, guildId: request.params.guildId }, "Failed to load reaction-role panel data.");
            }
            return reply.code(normalized.status).send({ error: normalized.error });
        }
    });

    fastify.post<{ Params: { guildId: string }; Body: { channelId: string; title: string; description: string; entries: ReactionEntryInput[] } }>('/:guildId/reaction-roles', { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const { channelId, title, description, entries } = request.body;
            if (!channelId || !title?.trim() || !description?.trim() || !Array.isArray(entries) || entries.length < 1 || entries.length > 20) return reply.code(400).send({ error: "A channel, title, description, and 1-20 role reactions are required." });
            const roles = await getBotGuildRoles(request.params.guildId);
            if (entries.some((entry) => !entry.roleId || !entry.emoji || !roles.some((role) => role.id === entry.roleId && !role.managed))) return reply.code(400).send({ error: "Every reaction must use a valid, non-managed guild role." });
            const prefix = request.params.guildId.slice(-4);
            const existing = await fastify.prisma.reactionRole.findMany({ select: { id: true } });
            const id = nextId(existing.map((panel) => panel.id), prefix);
            const message = await createBotEmbedMessage(channelId, title.trim(), description.trim());
            const panel = await fastify.prisma.reactionRole.create({ data: { id, gID: request.params.guildId, messageId: message.id, channelId, title: title.trim(), description: description.trim(), roles: { create: entries.map((entry, index) => ({ id: `${id}-${String(index + 1).padStart(3, "0")}`, roleId: entry.roleId, emoji: entry.emoji })) } }, include: { roles: true } });
            await Promise.all(entries.map((entry) => addBotReaction(channelId, message.id, entry.emoji)));
            return reply.code(201).send({ panel });
        } catch (error) {
            const normalized = normalizeReactionRoleRouteError(error, "Failed to create reaction role panel.");
            if (normalized.status >= 500) {
                fastify.log.error({ err: error, guildId: request.params.guildId }, "Failed to create reaction-role panel.");
            }
            return reply.code(normalized.status).send({ error: normalized.error });
        }
    });

    fastify.delete<{ Params: { guildId: string; panelId: string } }>('/:guildId/reaction-roles/:panelId', { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const panel = await fastify.prisma.reactionRole.findFirst({ where: { id: request.params.panelId, gID: request.params.guildId } });
            if (!panel) return reply.code(404).send({ error: "Reaction role panel not found." });
            await deleteBotMessage(panel.channelId, panel.messageId).catch(() => undefined);
            await fastify.prisma.reactionRole.delete({ where: { id: panel.id } });
            return { deleted: true };
        } catch (error) {
            const normalized = normalizeReactionRoleRouteError(error, "Failed to delete reaction role panel.");
            if (normalized.status >= 500) {
                fastify.log.error({ err: error, guildId: request.params.guildId }, "Failed to delete reaction-role panel.");
            }
            return reply.code(normalized.status).send({ error: normalized.error });
        }
    });
}
