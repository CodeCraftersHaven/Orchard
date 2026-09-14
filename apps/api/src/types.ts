import type { SessionPayload } from "@orchard/types";
import { PrismaClient } from "@orchard/database";

export const PermissionFlagsBits = {
  Administrator: 0x8n,
  ManageGuild: 0x20n,
} as const;

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessionPayload;
    user: SessionPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user: SessionPayload;
  }
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
