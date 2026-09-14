import { commandModule, CommandType } from '@sern/handler';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  TextDisplayBuilder,
  ApplicationCommandOptionType
} from 'discord.js';

const positions = ['left', 'middle', 'right'] as const;
type AvatarPosition = (typeof positions)[number];

function isAvatarPosition(value: string): value is AvatarPosition {
  return positions.includes(value as AvatarPosition);
}

export default commandModule({
  type: CommandType.Slash,
  description: 'Configure an Orchard system.',
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'system',
      description: 'The Orchard system to configure.',
      required: true,
      choices: [
        { name: 'Welcome messages', value: 'welcome' },
        { name: 'Birthday messages', value: 'birthdays' }
      ]
    },
    {
      type: ApplicationCommandOptionType.String,
      name: 'action',
      description: 'Enable or disable the selected system.',
      required: false,
      choices: [
        { name: 'Enable', value: 'enable' },
        { name: 'Disable', value: 'disable' }
      ]
    }
  ],
  async execute(ctx, { deps }) {
    if (!ctx.inGuild || !(ctx.member?.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)) {
      await ctx.reply({ content: 'Administrator permissions are required to configure Orchard.', flags: MessageFlags.Ephemeral });
      return;
    }

    const system = ctx.options.getString('system', true);
    if (system === 'birthdays') {
      const action = ctx.options.getString('action');
      const birthday = await deps.prisma.birthday.upsert({
        where: { gID: ctx.guildId! },
        update: action ? { settings: { update: { enabled: action === 'enable' } } } : {},
        create: { gID: ctx.guildId!, settings: { create: { gID: ctx.guildId!, enabled: action === 'enable' } } },
        include: { settings: true }
      });
      const status = action ? action === 'enable' : birthday.settings.enabled ? 'enabled' : 'disabled';
      await ctx.reply({ content: `Birthday announcements are **${status}** for this server. Configure announcement and log channels in the dashboard.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (system !== 'welcome') {
      await ctx.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Birthday messages\nBirthday setup is not available in this container yet.')
          )
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
      return;
    }

    const guild = await deps.prisma.welcomeSettings.upsert({
      where: { gID: ctx.guildId! },
      update: {},
      create: { gID: ctx.guildId! }
    });
    const currentPosition = isAvatarPosition(guild.avatarPosition) ? guild.avatarPosition : 'middle';
    const backgroundDescription = guild.backgroundUrl
      ? `Current background: ${guild.backgroundUrl}`
      : 'Current background: Orchard default';
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Welcome messages\nChoose where the member avatar appears in welcome images.\n\nCurrent position: **${currentPosition}**\n${backgroundDescription}`
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...positions.map(position =>
            new ButtonBuilder()
              .setCustomId(`setup-welcome-avatar/${position}`)
              .setLabel(position[0].toUpperCase() + position.slice(1))
              .setStyle(position === currentPosition ? ButtonStyle.Success : ButtonStyle.Secondary)
          )
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('setup-welcome-background')
            .setLabel('Change background')
            .setStyle(ButtonStyle.Primary)
        )
      );

    await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
});