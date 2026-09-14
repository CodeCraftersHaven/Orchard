import type { CoreDependencies } from '@sern/handler';
import { TaskLogger, Sparky, PrismaClient } from '#utils';
import { Orchard } from '#Orchard';
import { Publisher } from '@sern/publisher';

declare global {
  interface Dependencies extends CoreDependencies {
    '@sern/client': Orchard;
    '@sern/logger': Sparky;
    'prisma': PrismaClient;
    'publisher': Publisher;
    'task-logger': TaskLogger;
  }
}

export { };
