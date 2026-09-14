import type { FastifyInstance } from "fastify";
import { getBotGuildIds } from "../lib/discord.js";

export default async function statsRoutes(fastify: FastifyInstance) {
    fastify.get("/", async (_request, reply) => {
        try {
            const [botGuildIds, authorizedUsers] = await Promise.all([
                getBotGuildIds(),
                fastify.prisma.user.count(),
            ]);

            const guilds = await fastify.prisma.serverStats.findMany({
                where: { gID: { in: [...botGuildIds] } },
                select: { userCount: true },
            });

            return {
                watchedServers: botGuildIds.size,
                authorizedUsers,
                watchedMembers: guilds.reduce((total, guild) => total + guild.userCount, 0),
            };
        } catch (err) {
            fastify.log.error(err);
            return reply.code(502).send({ error: "Failed to load Orchard statistics" });
        }
    });
}