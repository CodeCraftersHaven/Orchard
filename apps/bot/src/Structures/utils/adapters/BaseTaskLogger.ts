import { Colors, EmbedBuilder, Guild } from 'discord.js';
import { Service } from '@sern/handler';
import { today } from '#utils';

export abstract class BaseTaskLogger {
  constructor() { }
  protected get client() {
    return Service('@sern/client');
  }
  protected get db() {
    return Service('prisma');
  }

  protected async getChannel(guild: Guild): Promise<import('discord.js').TextBasedChannel | undefined> {
    return this.db.guild.findUnique({
      where: { gID: guild.id },
    }).then(async (guildData) => {
      if (!guildData) return;
      const channel = await guild.channels.fetch(guildData.taskLogsChannelId);
      if (!channel || !channel.isTextBased()) return;
      return channel;
    });
  }

  async channelSend(guild: Guild, info: string) {
    let channel = await this.getChannel(guild);
    if (!channel || !channel.isTextBased()) return;
    channel = channel as import('discord.js').TextChannel;
    const messages = await channel.messages.fetch();
    const message = messages.find(m => m.author.id === this.client.user?.id && m.embeds[0]?.title === 'Task Logger');

    const embed = new EmbedBuilder({
      title: 'Task Logger',
      description: info,
      color: Colors.Green,
      timestamp: Date.now(),
      footer: {
        text: this.client.user?.username ?? '',
        icon_url: this.client.user?.displayAvatarURL() ?? ''
      }
    });
    if (message) {
      await message.edit({
        embeds: [embed]
      });

      await this.db.taskMessages.upsert({
        where: { messageId: message.id },
        create: { messageId: message.id },
        update: { messageId: message.id }
      });
    } else {
      const newMessage = await channel.send({
        embeds: [embed]
      });

      await this.db.taskMessages.create({
        data: { messageId: newMessage.id }
      });
    }
  }

  async bdaySend(guild: Guild, info: string) {
    let channel = await this.getChannel(guild);
    if (!channel || !channel.isTextBased()) return;
    channel = channel as import('discord.js').TextChannel;

    const messages = await channel.messages.fetch();
    const message = messages.find(
      m => m.author.id === this.client.user?.id && m.embeds[0]?.title === 'Birthday Dates Checked'
    );

    const date = info.trim();

    if (message) {
      const embed = EmbedBuilder.from(message.embeds[0]);
      let description = embed.data.description!.trim();
      const todayDate = today();

      if (!description.includes(date)) {
        if (description.length > 0) {
          description += `, \`${todayDate}\``;
        } else {
          description = `\`${todayDate}\``;
        }
      }
      embed.setDescription(description);
      await message.edit({
        embeds: [embed]
      });

      await this.db.taskMessages.upsert({
        where: { messageId: message.id },
        create: { messageId: message.id },
        update: { messageId: message.id }
      });
    } else {
      const embed = new EmbedBuilder({
        title: 'Birthday Dates Checked',
        description: `Task: \`birthday\` was executed successfully on:\n\`${date}\``,
        color: Colors.Green,
        timestamp: Date.now(),
        footer: {
          text: this.client.user?.username ?? '',
          icon_url: this.client.user?.displayAvatarURL() ?? ''
        }
      });
      const newMessage = await channel.send({
        embeds: [embed]
      });

      await this.db.taskMessages.create({
        data: { messageId: newMessage.id }
      });
    }
  }
}
