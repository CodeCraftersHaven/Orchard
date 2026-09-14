import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags, ModalBuilder, PermissionFlagsBits, PermissionsBitField, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { defaultWelcomeBackgroundUrl } from '#utils';

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export default commandModule({
  type: CommandType.Button,
  name: 'setup-welcome-background',
  description: 'Change the welcome background image.',
  async execute(ctx, { deps }) {
    if (!ctx.inGuild || !(ctx.member?.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)) {
      await ctx.reply({ content: 'Administrator permissions are required to configure Orchard.', flags: MessageFlags.Ephemeral });
      return;
    }

    const settings = await deps.prisma.welcomeSettings.findUnique({ where: { gID: ctx.guildId! } });
    const modal = new ModalBuilder().setCustomId('setup-welcome-background-submit').setTitle('Welcome background');
    const input = new TextInputBuilder()
      .setCustomId('background-url')
      .setLabel('Public HTTPS image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(settings?.backgroundUrl || defaultWelcomeBackgroundUrl)
      .setPlaceholder('Leave blank to restore the Orchard default');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await ctx.showModal(modal);
  }
});
