import * as config from './config.js';
import { Orchard } from '#Orchard';
import { makeDependencies, Sern } from '@sern/handler';
import { logger, TaskLogger, prisma } from '#utils';
import { Publisher } from '@sern/publisher';


await makeDependencies(({ add, swap }) => {
  add('@sern/client', new Orchard());
  swap('@sern/logger', logger);
  add('prisma', prisma);
  add('publisher', deps => new Publisher(deps['@sern/modules'], deps['@sern/emitter'], deps['@sern/logger']));
  add('task-logger', new TaskLogger());
});

Sern.init(config);
