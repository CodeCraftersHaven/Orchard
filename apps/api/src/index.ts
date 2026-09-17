import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { env } from "@orchard/config";
import { prisma } from "@orchard/database";
import { checkBotHealth } from "./lib/discord.js";
import authPlugin from "./plugins/authenticate.js";
import router from "./routes/index.js";

const DASH_BASE_URL = env.BASE_URL;
const PORT = Number(env.API_PORT);

const fastify = Fastify({
  logger: env.NODE_ENV === "production" ? true : { transport: { target: "pino-pretty" } },
});

await fastify.register(cors, {
  origin: DASH_BASE_URL,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
});

fastify.decorate("prisma", prisma);

await fastify.register(cookie);
await fastify.register(jwt, { secret: env.JWT_SECRET });
await fastify.register(authPlugin);

fastify.get("/api/health", async () => {
  const databaseStartedAt = Date.now();
  const botPromise = checkBotHealth();
  let databaseStatus: "up" | "down" = "up";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "down";
  }

  const bot = await botPromise;
  const database = {
    status: databaseStatus,
    latencyMs: Date.now() - databaseStartedAt,
  };

  return {
    status: bot.status === "up" && database.status === "up" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks: { api: { status: "up" as const }, bot, database },
  };
});
await fastify.register(router, { prefix: "/api" });


try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API server listening on port ${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
