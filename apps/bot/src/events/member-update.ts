import { EventType, eventModule, Service } from '@sern/handler';
import { Events } from 'discord.js';

export default eventModule({
    type: EventType.Discord,
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        if (oldMember.partial) await oldMember.fetch();
        if (newMember.partial) await newMember.fetch();
        const prisma = Service('prisma');
        if (newMember.nickname !== oldMember.nickname) {
            await prisma.moneyUser.updateMany({
                where: { id: oldMember.id || newMember.id },
                data: { nickname: newMember.nickname }
            });
        }
    }
});