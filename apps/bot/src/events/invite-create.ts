import { eventModule, EventType } from '@sern/handler';
import { Events, Guild, PermissionFlagsBits } from 'discord.js';

export default eventModule({
    type: EventType.Discord,
    name: Events.InviteCreate,
    async execute(invite) {
        console.log(`Invite created: ${invite.code}`);
        const guild = invite.guild as Guild;
        const member = guild.members.cache.get(invite.inviter?.id!);

        if (invite.channel !== guild.rulesChannel) { 
            await invite.delete("Invite not created in the rules channel."); 
            return 
        }
        if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await invite.delete("Invite not created by an administrator.");
            return;
        }
        if (invite.temporary) await invite.delete("Temporary invite not allowed.");
    },
});