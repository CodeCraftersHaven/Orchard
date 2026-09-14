import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export default commandModule({
  type: CommandType.Modal,
  name: 'setup-welcome-background-submit',
  description: 'Save the welcome background image.',
  async execute(ctx, { deps }) {
    if (!ctx.inGuild || !(ctx.member?.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)) {
      await ctx.reply({ content: 'Administrator permissions are required to configure Orchard.', flags: MessageFlags.Ephemeral });
      return;
    }

    const value = ctx.fields.getTextInputValue('background-url').trim();
    if (value && !isHttpsUrl(value)) {
      await ctx.reply({ content: 'Please provide a valid HTTPS image URL.', flags: MessageFlags.Ephemeral });
      return;
    }

    await deps.prisma.welcomeSettings.upsert({
      where: { gID: ctx.guildId! },
      update: { backgroundUrl: value },
      create: { gID: ctx.guildId!, backgroundUrl: value }
    });
    await ctx.reply({ content: value ? 'Welcome background updated.' : 'Welcome background reset to the Orchard default.', flags: MessageFlags.Ephemeral });
  }
});