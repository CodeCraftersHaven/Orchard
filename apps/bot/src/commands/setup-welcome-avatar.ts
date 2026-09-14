import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const positions = ['left', 'middle', 'right'] as const;
type AvatarPosition = (typeof positions)[number];

function isAvatarPosition(value: string): value is AvatarPosition {
  return positions.includes(value as AvatarPosition);
}

export default commandModule({
  type: CommandType.Button,
  name: 'setup-welcome-avatar',
  description: 'Change the welcome avatar position.',
  async execute(ctx, { deps, params }) {
    if (!ctx.inGuild || !(ctx.member?.permissions as PermissionsBitField).has(PermissionFlagsBits.Administrator)) {
      await ctx.reply({ content: 'Administrator permissions are required to configure Orchard.', flags: MessageFlags.Ephemeral });
      return;
    }

    const position = params?.[0];
    if (!position || !isAvatarPosition(position)) return;
    await deps.prisma.welcomeSettings.upsert({
      where: { gID: ctx.guildId! },
      update: { avatarPosition: position },
      create: { gID: ctx.guildId!, avatarPosition: position }
    });
    await ctx.update({ content: `Welcome avatar position set to **${position}**.`, components: [] });
  }
});