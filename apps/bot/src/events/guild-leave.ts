import { env } from '#utils';
import { EventType, Service, eventModule } from '@sern/handler';
import { Events, TextChannel } from 'discord.js';

export default eventModule({
    type: EventType.Discord,
    name: Events.GuildDelete,
    execute: async (guild) => {
        const client = Service('@sern/client');
        const channelId = env.NODE_ENV === 'production' ? '1545164648079429765' : '1550215588335460423';

        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (channel?.isTextBased()) {
            await channel.send({
                embeds: [
                    {
                        title: 'Guild Left',
                        description: `The guild **${guild.name}** has removed the bot from their server.`,
                        color: 0xff0000
                    }
                ]
            });
        }
    }
})