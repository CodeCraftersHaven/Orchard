import type { FastifyInstance } from "fastify";
import { getCurrentUserGuilds, hasAdministratorPermission } from "../lib/discord.js";

type Params = { guildId: string };
type ItemBody = { item: string; game: "scavenger-hunt" | "fishing" | "farming"; value: number };

async function requireAdministrator(fastify: FastifyInstance, request: { user: { accessToken: string }; params: Params }) {
    const guilds = await getCurrentUserGuilds(request.user.accessToken);
    const guild = guilds.find(entry => entry.id === request.params.guildId);
    if (!guild || !hasAdministratorPermission(guild)) throw new Error("FORBIDDEN");
}

function itemId(serverId: string, item: string) {
    return `${serverId}-${item.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
}

export default async function economyRoutes(fastify: FastifyInstance) {
    fastify.get<{ Params: Params }>("/:guildId/economy/items", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            return fastify.prisma.economyItemDefinition.findMany({ where: { serverId: request.params.guildId }, orderBy: [{ game: "asc" }, { item: "asc" }] });
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            return reply.code(message === "FORBIDDEN" ? 403 : 502).send({ error: message === "FORBIDDEN" ? "Administrator permissions are required." : "Failed to load economy items." });
        }
    });

    fastify.post<{ Params: Params; Body: ItemBody }>("/:guildId/economy/items", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const { item, game, value } = request.body;
            if (!item?.trim() || !["scavenger-hunt", "fishing", "farming"].includes(game) || !Number.isInteger(value) || value < 1) return reply.code(400).send({ error: "A name, valid game, and positive value are required." });
            const definition = await fastify.prisma.economyItemDefinition.upsert({ where: { serverId_item: { serverId: request.params.guildId, item: item.trim() } }, update: { game, value }, create: { id: itemId(request.params.guildId, item.trim()), serverId: request.params.guildId, item: item.trim(), game, value } });
            return reply.code(201).send(definition);
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            return reply.code(message === "FORBIDDEN" ? 403 : 502).send({ error: message === "FORBIDDEN" ? "Administrator permissions are required." : "Failed to save economy item." });
        }
    });

    fastify.patch<{ Params: Params & { itemId: string }; Body: { game?: ItemBody["game"]; value?: number } }>("/:guildId/economy/items/:itemId", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const value = request.body.value;
            const data = { ...(request.body.game ? { game: request.body.game } : {}), ...(typeof value === "number" && Number.isInteger(value) && value >= 1 ? { value } : {}) };
            if (!Object.keys(data).length) return reply.code(400).send({ error: "Provide a valid game or positive value." });
            const existing = await fastify.prisma.economyItemDefinition.findFirst({ where: { id: request.params.itemId, serverId: request.params.guildId } });
            if (!existing) return reply.code(404).send({ error: "Economy item not found." });
            return fastify.prisma.economyItemDefinition.update({ where: { id: existing.id }, data });
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            return reply.code(message === "FORBIDDEN" ? 403 : 502).send({ error: message === "FORBIDDEN" ? "Administrator permissions are required." : "Failed to update economy item." });
        }
    });

    fastify.delete<{ Params: Params & { itemId: string } }>("/:guildId/economy/items/:itemId", { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            await requireAdministrator(fastify, request);
            const existing = await fastify.prisma.economyItemDefinition.findFirst({ where: { id: request.params.itemId, serverId: request.params.guildId } });
            if (!existing) return reply.code(404).send({ error: "Economy item not found." });
            await fastify.prisma.economyItemDefinition.delete({ where: { id: existing.id } });
            return { deleted: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            return reply.code(message === "FORBIDDEN" ? 403 : 502).send({ error: message === "FORBIDDEN" ? "Administrator permissions are required." : "Failed to delete economy item." });
        }
    });
}