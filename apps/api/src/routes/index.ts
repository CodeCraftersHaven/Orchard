import type { FastifyInstance } from "fastify";
import authRoutes from "./auth.js";
import guildRoutes from "./guilds.js";
import statsRoutes from "./stats.js";
export default async function router(
    fastify: FastifyInstance,
) {
    await fastify.register(authRoutes, { prefix: "/auth" });
    await fastify.register(guildRoutes, { prefix: "/guilds" });
    await fastify.register(statsRoutes, { prefix: "/stats" });
}