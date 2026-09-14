import { scheduledTask } from '@sern/handler';
import { getRandomMessage, today } from '#utils';

export default scheduledTask({
  timezone: 'America/Chicago',
  trigger: '0 7 * * *',
  async execute(_, sdt) {
    const [c, i, p] = [sdt.deps['@sern/client'], sdt.deps['task-logger'], sdt.deps.prisma];
    const entries = await p.birthdayEntry.findMany({
      where: { date: today() },
      include: { subscriptions: { include: { birthday: { include: { settings: true } } } } }
    });

    for (const entry of entries) {
      for (const subscription of entry.subscriptions) {
        if (!subscription.birthday.settings.enabled) continue;
        const guildId = subscription.gID;
        const guild = c.guilds.cache.get(guildId);
        if (!guild) continue;

        await guild.members.fetch();
        const birthdayChannel = guild.channels.cache.get(subscription.birthday.settings.announceChannelId);
        if (!birthdayChannel || !birthdayChannel.isTextBased()) continue;

        const message = `@everyone, We have a birthday today!\n${getRandomMessage([`<@${entry.userID}>`])}`;
        await birthdayChannel.send(message);
        await i.channelSend(guild, 'Task: `birthday` congratulated 1 person.');
        await i.bdaySend(guild, today());
      }
    }
  }
});
