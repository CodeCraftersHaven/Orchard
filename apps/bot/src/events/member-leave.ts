import { EventType, eventModule, Services } from '@sern/handler';
import { EmbedBuilder, Events, GuildMember, TextChannel } from 'discord.js';

async function stillSharesGuildWithBot(member: Pick<GuildMember, 'id' | 'guild' | 'client'>) {
    const guilds = [...member.client.guilds.cache.values()];
    for (const guild of guilds) {
        if (guild.id === member.guild.id) continue;
        try {
            await guild.members.fetch(member.id);
            return true;
        } catch {
            // Discord returns an unknown-member error when the user is not in this guild.
        }
    }
    return false;
}

export default eventModule({
    type: EventType.Discord,
    name: Events.GuildMemberRemove,
    execute: async member => {
        const [taskLogger, prisma] = Services('task-logger', 'prisma');
        const [guild, stats] = await Promise.all([
            prisma.guild.findUnique({ where: { gID: member.guild.id } }),
            prisma.serverStats.findUnique({ where: { gID: member.guild.id } }),
        ]);

        if (stats) {
            const guild = await member.guild.fetch();
            await prisma.serverStats.update({
                where: { gID: member.guild.id },
                data: member.user.bot
                    ? { botCount: Math.max(0, stats.botCount - 1), allCount: Math.max(0, guild.memberCount) }
                    : { userCount: Math.max(0, stats.userCount - 1), allCount: Math.max(0, guild.memberCount) },
            });
        }

        const leaveChannel = guild?.leaveEnabled && guild.leaveChannelId
            ? await member.guild.channels.fetch(guild.leaveChannelId).catch(() => null)
            : null;
        if (leaveChannel instanceof TextChannel) {
            const message = await leaveChannel.send({
                embeds: [new EmbedBuilder()
                    .setDescription(`[${member.user.username}](https://discord.com/users/${member.user.id}) left the server.`)
                    .setTimestamp()
                    .setColor('Red')
                    .setFooter({
                        text: member.client.user.username,
                        iconURL: member.client.user.displayAvatarURL({ size: 1024 }),
                    })],
            });
            await message.react('👋').catch(() => undefined);
        }

        const birthday = await prisma.birthdayEntry.findUnique({ where: { userID: member.id } });
        if (!birthday) return;

        await prisma.birthdaySubscription.deleteMany({
            where: { userID: member.id, gID: member.guild.id },
        });

        if (await stillSharesGuildWithBot(member)) return;

        await prisma.birthdayEntry.delete({ where: { userID: member.id } });

        const birthdayGuild = await prisma.birthday.findUnique({
            where: { gID: member.guild.id },
            include: { settings: true },
        });
        if (birthdayGuild?.settings.logChannelId) {
            await taskLogger.bdays.logBirthdays(member.guild);
        }
    },
});
