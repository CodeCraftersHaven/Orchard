import { EventType, eventModule } from '@sern/handler';
import { EmbedBuilder, Events, MessageReaction, TextChannel, User } from 'discord.js';
import { Service } from '@sern/handler';
import { channelUpdater, env, welcomeCreate } from '#utils';

const reactionKey = (reaction: MessageReaction) => reaction.emoji.id
    ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
    : reaction.emoji.name ?? reaction.emoji.toString();

export default eventModule({
    type: EventType.Discord,
    name: Events.MessageReactionAdd,
    execute: async (reaction: MessageReaction, user: User) => {
        if (user.bot || !reaction.message.guildId) return;
        const prisma = Service('prisma');
        const [panel, verificationGuild] = await Promise.all([
            prisma.reactionRole.findFirst({
                where: { gID: reaction.message.guildId, messageId: reaction.message.id },
                include: { roles: true },
            }),
            prisma.guild.findUnique({ where: { gID: reaction.message.guildId } }),
        ]);
        const entry = panel?.roles.find((role) => role.emoji === reactionKey(reaction) || role.emoji === reaction.emoji.name);
        const isVerificationReaction = verificationGuild?.reactionMessageId === reaction.message.id;
        if (!entry && !isVerificationReaction) return;
        if (entry) {
            const member = await reaction.message.guild?.members.fetch(user.id);
            const role = reaction.message.guild?.roles.cache.get(entry.roleId);
            if (!member || !role) return;
            await member.roles.add(role).catch(() => undefined);
        }

        //verification system
        if (!reaction.message.inGuild()) return;
        let message = reaction.message;
        if (message.partial) await message.fetch();
        if (reaction.partial) await reaction.fetch();

        if (reaction.emoji.name === '🎉') {
            await message.react(`<:flame_party:${env.NODE_ENV === 'production' ? '1549489257545212066' : '1549489642318069812'}>`);
        }
        const counts = {
            users: message.guild.members.cache.filter(m => !m.user.bot).size!,
            bots: message.guild.members.cache.filter(m => m.user.bot).size!,
            total: message.guild.memberCount!
        };

        if (user.bot) return;
        if (!reaction.message.guild) return;
        let mmm = reaction.message.guild.members.cache.get(user.id)!;
        const [Guild, serverStats, welcomeSettings] = await Promise.all([
            prisma.guild.findFirst({
                where: {
                    gID: mmm.guild.id
                }
            }),
            prisma.serverStats.findUnique({ where: { gID: mmm.guild.id } }),
            prisma.welcomeSettings.findUnique({ where: { gID: mmm.guild.id } }),
        ]);
        if (!Guild) return;
        if (message.id === Guild.reactionMessageId && reaction.emoji.toString()) {
            let vRole = message.guild?.roles.cache.get(Guild.verifiedRole);
            if (!vRole) return;
            if (!mmm.roles.cache.has(vRole.id)) {
                if (serverStats && mmm.guild.memberCount === serverStats.allCount) return;
                await message.guild.members.cache
                    .get(user.id)
                    ?.roles.add(vRole)
                    .catch(err => console.log(err));
                if (Guild.nonVerifiedRoleId) {
                    await message.guild.members.cache
                        .get(user.id)
                        ?.roles.remove(Guild.nonVerifiedRoleId)
                        .catch(err => console.log(err));
                }
                await message.channel
                    .send(
                        `${mmm}, You may now introduce yourself in <#${Guild.introC}> and get your roles in <#${Guild.rolesChannelId}>.`
                    )
                    .then(async m => {
                        setTimeout(() => {
                            m.delete().catch(err => {
                                console.log("Regular Error. Couldn't Delete the message.\n" + err);
                            });
                        }, 10 * 1000);
                    });
                const welcomeChannel = mmm.guild.systemChannel
                    ?? (welcomeSettings?.channelId ? await mmm.guild.channels.fetch(welcomeSettings.channelId).catch(() => null) : null);
                await welcomeCreate(mmm, mmm.guild.name, counts.users, welcomeChannel instanceof TextChannel ? welcomeChannel : null, {
                    intro: Guild.announcementsChannelId,
                    roles: Guild.rolesChannelId
                }).then(async () => {
                    const Verification = await prisma.member.findFirst({
                        where: { memberId: mmm.id }
                    });
                    if (!Verification) return;
                    const channel = (await message.guild?.channels.fetch(Guild.modC)) as TextChannel;
                    const msg = await channel.messages.fetch(Verification.messageId);
                    await msg
                        .edit({
                            components: [],
                            embeds: [
                                EmbedBuilder.from(msg.embeds[0])
                                    .setFields([
                                        {
                                            name: 'Verification: ',
                                            value: `✅ - ${mmm} successfully verified!`
                                        }
                                    ])
                                    .setFooter(null)
                            ]
                        })
                        .then(async () => {
                            await prisma.member.delete({ where: { id: Verification.id } });
                        })
                        .finally(async () => {
                            await channelUpdater(mmm.guild);
                        });
                });
            }
        }
    }
});
