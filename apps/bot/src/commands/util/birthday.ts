import { bdayAnnouncement, today } from '#utils';
import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, GuildMember, PermissionFlagsBits } from 'discord.js';

const isAdministrator = (ctx: any) =>
  (ctx.member as unknown as GuildMember).permissions.has(PermissionFlagsBits.Administrator);

export default commandModule({
  type: CommandType.Slash,
  description: 'Manage birthdays in my memory.',
  plugins: [],
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: 'set',
      description: 'Set a global birthday and notify this server.',
      options: [
        { type: ApplicationCommandOptionType.User, name: 'user-to-add', description: 'Select a user.', required: true },
        { type: ApplicationCommandOptionType.String, name: 'date', description: 'Birthday in (MM/DD) format.', required: true }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: 'edit',
      description: 'Edit a global birthday.',
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'user-to-edit',
          description: 'Select the user to edit.',
          autocomplete: true,
          required: true,
          command: {
            onEvent: [],
            async execute(ctx, { deps }) {
              const birthday = await deps.prisma.birthday.findUnique({
                where: { gID: ctx.guildId! },
                include: { subscriptions: { include: { user: true } } }
              });
              const choices = birthday?.subscriptions.map(({ user }) => ({ name: `${user.username} (${user.date})`, value: user.userID })) ?? [];
              const visible = isAdministrator(ctx) ? choices : choices.filter(choice => choice.value === ctx.user.id);
              await ctx.respond(visible.filter(choice => choice.name.toLowerCase().startsWith(ctx.options.getFocused().toLowerCase())).slice(0, 25));
            }
          }
        },
        { type: ApplicationCommandOptionType.String, name: 'edit-date', description: 'Birthday in (MM/DD) format.', required: true }
      ]
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: 'delete',
      description: 'Delete a global birthday.',
      options: [{ type: ApplicationCommandOptionType.User, name: 'user-to-delete', description: 'Select a user.', required: false }]
    },
    { type: ApplicationCommandOptionType.Subcommand, name: 'enable', description: 'Receive birthday announcements in this server.' },
    { type: ApplicationCommandOptionType.Subcommand, name: 'disable', description: 'Stop receiving birthday announcements in this server.' },
    {
      name: 'get',
      type: ApplicationCommandOptionType.Subcommand,
      description: 'Check a global birthday.',
      options: [{ type: ApplicationCommandOptionType.User, name: 'user-to-get', description: 'Select a user.', required: false }]
    }
  ],
  async execute(ctx, { deps }) {
    if (!ctx.inGuild || !ctx.guildId) return ctx.reply({ flags: 64, content: 'This command can only be used in a server.' });

    const sub = ctx.options.getSubcommand(true);
    const birthday = await deps.prisma.birthday.upsert({
      where: { gID: ctx.guildId },
      update: {},
      create: { gID: ctx.guildId, settings: { create: { gID: ctx.guildId } } },
      include: { settings: true }
    });
    const requestedUser = ctx.options.getUser('user-to-add') ?? ctx.options.getUser('user-to-delete') ?? ctx.user;
    const targetId = ctx.options.getString('user-to-edit') ?? requestedUser.id;
    const pronoun = (userId: string) => userId === ctx.user.id ? 'your' : `<@${userId}>'s`;

    if (sub === 'enable' || sub === 'disable') {
      if (sub === 'enable') {
        const entry = await deps.prisma.birthdayEntry.findUnique({ where: { userID: ctx.user.id } });
        if (!entry) return ctx.reply({ flags: 64, content: 'Set your global birthday first with `/birthday set`.' });
        await deps.prisma.birthdaySubscription.upsert({
          where: { userID_gID: { userID: ctx.user.id, gID: ctx.guildId } },
          update: {},
          create: { userID: ctx.user.id, gID: ctx.guildId }
        });
      } else {
        await deps.prisma.birthdaySubscription.deleteMany({ where: { userID: ctx.user.id, gID: ctx.guildId } });
      }
      return ctx.reply({ flags: 64, content: sub === 'enable' ? 'You will receive birthday announcements in this server.' : 'You will no longer receive birthday announcements in this server.' });
    }

    if (sub === 'get') {
      const user = ctx.options.getUser('user-to-get') ?? ctx.user;
      const entry = await deps.prisma.birthdayEntry.findUnique({ where: { userID: user.id } });
      return ctx.reply({ flags: 64, content: entry ? `${pronoun(user.id)} birthday is set to \`${entry.date}\`.` : `I do not have ${pronoun(user.id)} birthday saved in my memory.` });
    }

    if (sub === 'set') {
      if (requestedUser.bot) return ctx.reply({ flags: 64, content: 'You cannot add a bot to my database.' });
      if (!isAdministrator(ctx) && requestedUser.id !== ctx.user.id) return ctx.reply({ flags: 64, content: "You do not have permission to manage other users' birthdays." });
      const date = ctx.options.getString('date', true);
      if (!deps['task-logger'].bdays.isValidDate(date)) return ctx.reply({ flags: 64, content: 'Please provide a date in format: `MM/DD`.' });
      const entry = await deps.prisma.birthdayEntry.upsert({
        where: { userID: requestedUser.id },
        update: { date, nickname: requestedUser.displayName, username: requestedUser.username },
        create: { userID: requestedUser.id, date, nickname: requestedUser.displayName, username: requestedUser.username }
      });
      await deps.prisma.birthdaySubscription.upsert({
        where: { userID_gID: { userID: requestedUser.id, gID: ctx.guildId } },
        update: {},
        create: { userID: requestedUser.id, gID: ctx.guildId }
      });
      if (date === today() && birthday.settings.enabled) await bdayAnnouncement(ctx, [`<@${requestedUser.id}>`]);
      return ctx.reply({ flags: 64, content: `I have set ${pronoun(requestedUser.id)} birthday as ${entry.date}. It is saved globally and this server is subscribed.` });
    }

    if (sub === 'edit') {
      if (targetId === 'none' || (!isAdministrator(ctx) && targetId !== ctx.user.id)) return ctx.reply({ flags: 64, content: 'You do not have permission to edit that birthday.' });
      const date = ctx.options.getString('edit-date', true);
      if (!deps['task-logger'].bdays.isValidDate(date)) return ctx.reply({ flags: 64, content: 'Please provide a date in format: `MM/DD`.' });
      const entry = await deps.prisma.birthdayEntry.update({ where: { userID: targetId }, data: { date } });
      if (date === today() && birthday.settings.enabled) await bdayAnnouncement(ctx, [`<@${targetId}>`]);
      return ctx.reply({ flags: 64, content: `I have updated ${pronoun(targetId)} birthday to \`${entry.date}\`.` });
    }

    if (!isAdministrator(ctx) && targetId !== ctx.user.id) return ctx.reply({ flags: 64, content: "You do not have permission to delete other users' birthdays." });
    const deleted = await deps.prisma.birthdayEntry.deleteMany({ where: { userID: targetId } });
    return ctx.reply({ flags: 64, content: deleted.count ? `I have deleted ${pronoun(targetId)} birthday from my memory.` : `I do not have ${pronoun(targetId)} birthday saved in my memory.` });
  }
});
