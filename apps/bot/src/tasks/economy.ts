import { scheduledTask } from '@sern/handler';

export default scheduledTask({
  timezone: 'UTC',
  trigger: '* * * * *',
  async execute(_, sdt) {
    const client = sdt.deps['@sern/client'];
    const prisma = sdt.deps.prisma;
    const now = new Date();
    const [plots, jobs] = await Promise.all([
      prisma.economyFarmPlot.findMany({ where: { readyAt: { lte: now }, completionNotifiedAt: null, notificationChannelId: { not: '' }, notificationMessageId: { not: '' } } }),
      prisma.economyCraftJob.findMany({ where: { readyAt: { lte: now }, completionNotifiedAt: null, notificationChannelId: { not: '' }, notificationMessageId: { not: '' } } }),
    ]);

    for (const plot of plots) {
      const channel = await client.channels.fetch(plot.notificationChannelId).catch(() => null);
      const message = channel?.isTextBased() ? await channel.messages.fetch(plot.notificationMessageId).catch(() => null) : null;
      if (message) await message.reply(`<@${plot.userId}> 🌾 Your **${plot.crop}** is ready to harvest!`).catch(() => undefined);
      await prisma.economyFarmPlot.update({ where: { id: plot.id }, data: { completionNotifiedAt: now } });
    }
    for (const job of jobs) {
      const channel = await client.channels.fetch(job.notificationChannelId).catch(() => null);
      const message = channel?.isTextBased() ? await channel.messages.fetch(job.notificationMessageId).catch(() => null) : null;
      if (message) await message.reply(`<@${job.userId}> 🍞 Your **${job.output}** is ready to collect!`).catch(() => undefined);
      await prisma.economyCraftJob.update({ where: { id: job.id }, data: { completionNotifiedAt: now } });
    }
  },
});
