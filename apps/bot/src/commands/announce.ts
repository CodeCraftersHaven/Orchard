import { IntegrationContextType, publishConfig } from "#plugins";
import { commandModule, CommandType } from "@sern/handler";
import { ApplicationCommandOptionType, ChannelType, PermissionFlagsBits, TextChannel } from "discord.js";

export default commandModule({
    type: CommandType.Both,
    description: "Announce a message to the server",
    plugins: [
        publishConfig({
            contexts: [IntegrationContextType.GUILD],
            integrationTypes: ["Guild"],
            defaultMemberPermissions: PermissionFlagsBits.Administrator
        })
    ],
    options: [
        {
            name: "message",
            description: "The message to announce",
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: "channel",
            description: "The channel to announce the message in",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText],
            required: false
        }
    ],
    execute: async (ctx) => {
        if (ctx.isMessage()) {
            if (!ctx.message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                return;
            }
            const args = ctx.message.content.trim().split(/\s+/).slice(1);
            const channelMention = args[0]?.match(/^<#(\d+)>$/);
            const channel = (channelMention
                ? ctx.message.mentions.channels.get(channelMention[1])
                : ctx.message.channel) as TextChannel | undefined;
            const message = channelMention ? args.slice(1).join(" ") : args.join(" ");
            if (channel?.isTextBased()) {
                await channel.send({
                    embeds: [
                        {
                            author: {
                                name: ctx.message.author.username,
                                icon_url: ctx.message.author.displayAvatarURL()
                            },
                            description: message,
                            timestamp: new Date().toISOString()
                        }
                    ]
                });
            }
            await ctx.message.delete();
        } else if (ctx.isSlash()) {
            const message = ctx.interaction.options.getString("message", true);
            const channel = (ctx.interaction.options.getChannel("channel", false) || ctx.channel) as TextChannel;
            if (channel.isTextBased()) {
                await channel.send({
                    embeds: [
                        {
                            author: {
                                name: ctx.interaction.user.username,
                                icon_url: ctx.interaction.user.displayAvatarURL()
                            },
                            description: message,
                            timestamp: new Date().toISOString()
                        }
                    ]
                }); channel
            }
        }
    }
});