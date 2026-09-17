import type { FastifyInstance } from "fastify";
import authRoutes from "./auth.js";
import guildRoutes from "./guilds.js";
import statsRoutes from "./stats.js";
import reactionRoleRoutes from "./reaction-roles.js";
import economyRoutes from "./economy.js";
export default async function router(
    fastify: FastifyInstance,
) {
    await fastify.register(authRoutes, { prefix: "/auth" });
    await fastify.register(guildRoutes, { prefix: "/guilds" });
    await fastify.register(statsRoutes, { prefix: "/stats" });
    await fastify.register(reactionRoleRoutes, { prefix: "/guilds" });
    await fastify.register(economyRoutes, { prefix: "/guilds" });
}