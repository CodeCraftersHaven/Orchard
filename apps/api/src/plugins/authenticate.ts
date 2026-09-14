import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * Adds `fastify.authenticate` — a preHandler that verifies the bearer JWT
 * issued after the Discord OAuth callback and populates `request.user`.
 */
export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
