import { eventModule, EventType } from "@sern/handler";
import { Events } from "discord.js";
import { Service } from "@sern/handler";

export default eventModule({
  name: Events.ClientReady,
  type: EventType.Discord,
  execute: async (client) => {
    const prisma = Service('prisma');

    const syncMemberCounts = async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.members.fetch();
          const userCount = guild.members.cache.filter((member) => !member.user.bot).size;

          await prisma.guild.upsert({
            where: { gID: guild.id },
            update: { gName: guild.name },
            create: { gID: guild.id, gName: guild.name },
          });
          await prisma.serverStats.upsert({
            where: { gID: guild.id },
            update: { userCount },
            create: { gID: guild.id, userCount },
          });
        } catch (error) {
          console.error(`Failed to sync member count for ${guild.name} (${guild.id})`, error);
        }
      }
    };

    await syncMemberCounts();
    setInterval(() => void syncMemberCounts(), 5 * 60 * 1000);

    const divider = "═".repeat(48);
    const serverCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const channelCount = client.channels.cache.size;

    console.log(`
╔${divider}╗
   🌿  THE ORCHARD  •  SYSTEM ONLINE  🌿
╚${divider}╝
  • Bot Tag       : ${client.user.tag}
  • Status        : Ripe and ready for harvest 🍎
  • Serving       : ${serverCount} guild(s) | ${userCount.toLocaleString()} members
  • Channels      : ${channelCount} tracked
  • Latency       : ${client.ws.ping}ms
  • Node Version  : ${process.version}
╔${divider}╗
  Watching the branches bloom and the fruit ripen! 🌱
╚${divider}╝
        `.trim());

    client.user.setActivity("over the orchard 🍎", { type: 3 });
  }
});