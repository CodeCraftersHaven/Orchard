import { EventType, eventModule, Service } from '@sern/handler';
import { Events, MessageReaction, User } from 'discord.js';

const reactionKey = (reaction: MessageReaction) => reaction.emoji.id
    ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
    : reaction.emoji.name ?? reaction.emoji.toString();

export default eventModule({
    type: EventType.Discord,
    name: Events.MessageReactionRemove,
    execute: async (reaction: MessageReaction, user: User) => {
        if (user.bot || !reaction.message.guildId) return;
        const prisma = Service('prisma');
        const panel = await prisma.reactionRole.findFirst({ where: { gID: reaction.message.guildId, messageId: reaction.message.id }, include: { roles: true } });
        const entry = panel?.roles.find((role) => role.emoji === reactionKey(reaction) || role.emoji === reaction.emoji.name);
        if (!entry) return;
        const member = await reaction.message.guild?.members.fetch(user.id);
        if (!member) return;
        await member.roles.remove(entry.roleId).catch(() => undefined);
    }
});