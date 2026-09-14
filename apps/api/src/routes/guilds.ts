import type { FastifyInstance } from "fastify";
import {
  getBotGuildIds,
  getBotGuildChannels,
  getBotInviteUrl,
  getCurrentUserGuilds,
  hasAdministratorPermission,
  guildIconUrl,
} from "../lib/discord.js";

export default async function guildRoutes(fastify: FastifyInstance) {
  // All servers visible to the logged-in user, annotated with permissions and bot presence.
  fastify.get(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const [userGuilds, botGuildIds] = await Promise.all([
          getCurrentUserGuilds(request.user.accessToken),
          getBotGuildIds(),
        ]);

        const guilds = userGuilds
          .map((guild) => {
            const botInGuild = botGuildIds.has(guild.id);
            return {
              id: guild.id,
              name: guild.name,
              icon: guildIconUrl(guild),
              owner: guild.owner,
              administrator: hasAdministratorPermission(guild),
              botInGuild,
              inviteUrl: !botInGuild ? getBotInviteUrl(guild.id) : null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return guilds;
      } catch (err) {
        fastify.log.error(err);
        return reply.code(502).send({ error: "Failed to load guilds from Discord" });
      }
    },
  );

  fastify.get<{ Params: { guildId: string } }>(
    "/:guildId/settings",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { guildId } = request.params;

      try {
        const [userGuilds, botGuildIds] = await Promise.all([
          getCurrentUserGuilds(request.user.accessToken),
          getBotGuildIds(),
        ]);
        const userGuild = userGuilds.find((guild) => guild.id === guildId);

        if (!userGuild || !hasAdministratorPermission(userGuild)) {
          return reply.code(403).send({ error: "Administrator permissions are required." });
        }
        if (!botGuildIds.has(guildId)) {
          return reply.code(409).send({ error: "The bot is not in this server." });
        }

        const [guild, birthday, counter, welcome, botWelcome, channels] = await Promise.all([
          fastify.prisma.guild.findUnique({ where: { gID: guildId } }),
          fastify.prisma.birthday.findUnique({ where: { gID: guildId }, include: { settings: true } }),
          fastify.prisma.counter.findUnique({ where: { gID: guildId } }),
          fastify.prisma.welcomeSettings.findUnique({ where: { gID: guildId } }),
          fastify.prisma.botWelcomeMessages.findUnique({ where: { gID: guildId } }),
          getBotGuildChannels(guildId),
        ]);

        return {
          guild: {
            ...(guild ?? { gID: guildId, gName: userGuild.name }),
            birthdayAnnounceChan: birthday?.settings.announceChannelId ?? "",
            birthdayEnabled: birthday?.settings.enabled ?? false,
            birthdayLogChannelId: birthday?.settings.logChannelId ?? "",
            birthdayLogMessageId: birthday?.settings.logMessageId ?? "",
            birthdayMonthLogMessageId: birthday?.settings.monthLogMessageId ?? "",
            countingChannel: counter?.channel ?? "",
            countingEnabled: counter?.active ?? false,
            welcomeC: welcome?.channelId ?? "",
            welcomeAvatarPosition: welcome?.avatarPosition ?? "middle",
            welcomeBackgroundUrl: welcome?.backgroundUrl ?? "",
            botWelcomeMessage: botWelcome?.messagesArray.join("; ") ?? "",
            botWelcomeMultiple: botWelcome ? !botWelcome.singleMessage : false,
            leaveC: welcome?.leaveChannelId ?? "",
          },
          channels: channels
            .filter((channel) => channel.type === 0)
            .map((channel) => ({
              ...channel,
              categoryName: channel.parent_id
                ? channels.find((parent) => parent.id === channel.parent_id && parent.type === 4)?.name
                : undefined,
            })),
        };
      } catch (err) {
        fastify.log.error(err);
        return reply.code(502).send({ error: "Failed to load guild settings" });
      }
    },
  );

  fastify.put<{
    Params: { guildId: string };
    Body: Record<string, unknown>;
  }>(
    "/:guildId/settings",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { guildId } = request.params;
      const editableFields = [
        "announcementsChannelId", "rolesChannelId", "modC", "birthdayAnnounceChan",
        "birthdayEnabled",
        "countingChannel", "countingEnabled",
        "birthdayLogChannelId", "gamingChannelId", "taskLogsChannelId", "verifiedRole",
        "reactionMessageID", "welcomeC", "welcomeAvatarPosition", "welcomeBackgroundUrl", "leaveC", "introC",
        "botWelcomeMessage", "botWelcomeMultiple",
      ] as const;

      try {
        const userGuilds = await getCurrentUserGuilds(request.user.accessToken);
        const userGuild = userGuilds.find((guild) => guild.id === guildId);
        if (!userGuild || !hasAdministratorPermission(userGuild)) {
          return reply.code(403).send({ error: "Administrator permissions are required." });
        }
        if (!(await getBotGuildIds()).has(guildId)) {
          return reply.code(409).send({ error: "The bot is not in this server." });
        }

        const data = Object.fromEntries(
          editableFields
            .filter((field) => {
              if (field === "birthdayEnabled") return typeof request.body?.[field] === "boolean";
              if (field === "countingEnabled") return typeof request.body?.[field] === "boolean";
              if (field === "botWelcomeMultiple") return typeof request.body?.[field] === "boolean";
              if (typeof request.body?.[field] !== "string") return false;
              if (field === "welcomeAvatarPosition") {
                return ["left", "middle", "right"].includes(request.body[field] as string);
              }
              if (field === "welcomeBackgroundUrl") {
                if (request.body[field] === "") return true;
                try {
                  const url = new URL(request.body[field] as string);
                  return url.protocol === "https:";
                } catch {
                  return false;
                }
              }
              return true;
            })
            .map((field) => [field, request.body[field] as string]),
        );
        const birthdayData: { announceChannelId?: string; logChannelId?: string; enabled?: boolean } = {};
        if (typeof data.birthdayAnnounceChan === "string") birthdayData.announceChannelId = data.birthdayAnnounceChan;
        if (typeof data.birthdayLogChannelId === "string") birthdayData.logChannelId = data.birthdayLogChannelId;
        if (typeof request.body?.birthdayEnabled === "boolean") birthdayData.enabled = request.body.birthdayEnabled;
        const countingData: { channel?: string; active?: boolean } = {};
        if (typeof data.countingChannel === "string") countingData.channel = data.countingChannel;
        if (typeof request.body?.countingEnabled === "boolean") countingData.active = request.body.countingEnabled;
        const welcomeData = Object.fromEntries(
          Object.entries(data)
            .filter(([field]) => field === "welcomeC" || field === "welcomeAvatarPosition" || field === "welcomeBackgroundUrl" || field === "leaveC")
            .map(([field, value]) => [
              { welcomeC: "channelId", welcomeAvatarPosition: "avatarPosition", welcomeBackgroundUrl: "backgroundUrl", leaveC: "leaveChannelId" }[field],
              value,
            ]),
        );
        const botWelcomeText = typeof data.botWelcomeMessage === "string" ? data.botWelcomeMessage.trim() : undefined;
        const botWelcomeData = botWelcomeText
          ? {
            gID: guildId,
            singleMessage: request.body?.botWelcomeMultiple !== true,
            messagesArray: request.body?.botWelcomeMultiple === true
              ? botWelcomeText.split(";").map((message) => message.trim()).filter(Boolean)
              : [botWelcomeText],
          }
          : null;
        const guildData = Object.fromEntries(
          Object.entries(data).filter(([field]) => ![
            "birthdayAnnounceChan", "birthdayLogChannelId", "welcomeC", "welcomeAvatarPosition", "welcomeBackgroundUrl", "leaveC",
            "birthdayEnabled", "countingChannel", "countingEnabled",
            "botWelcomeMessage", "botWelcomeMultiple",
          ].includes(field)),
        );
        const guild = await fastify.prisma.guild.upsert({
          where: { gID: guildId },
          create: { gID: guildId, gName: userGuild.name, ...guildData },
          update: guildData,
        });
        let birthdaySettings = null;
        if (Object.keys(birthdayData).length) {
          const birthday = await fastify.prisma.birthday.findUnique({
            where: { gID: guildId },
            select: { settingsId: true },
          });
          birthdaySettings = birthday
            ? await fastify.prisma.birthdaySettings.update({
              where: { gID: guildId },
              data: birthdayData,
            })
            : (await fastify.prisma.birthday.create({
              data: { gID: guildId, settings: { create: { gID: guildId, ...birthdayData } } },
              include: { settings: true },
            })).settings;
        }
        const welcomeSettings = Object.keys(welcomeData).length
          ? await fastify.prisma.welcomeSettings.upsert({
            where: { gID: guildId },
            create: { gID: guildId, ...welcomeData },
            update: welcomeData,
          })
          : null;
        const counter = Object.keys(countingData).length
          ? await fastify.prisma.counter.upsert({
            where: { gID: guildId },
            create: { gID: guildId, channel: countingData.channel ?? "", active: countingData.active ?? false, count: 0, highestCount: 0 },
            update: countingData,
          })
          : null;
        const botWelcome = botWelcomeData
          ? await fastify.prisma.botWelcomeMessages.upsert({
            where: { gID: guildId },
            create: botWelcomeData,
            update: { singleMessage: botWelcomeData.singleMessage, messagesArray: botWelcomeData.messagesArray },
          })
          : null;

        return { guild: { ...guild, ...data, ...(birthdaySettings ? { birthdayAnnounceChan: birthdaySettings.announceChannelId, birthdayLogChannelId: birthdaySettings.logChannelId } : {}), ...(counter ? { countingChannel: counter.channel, countingEnabled: counter.active } : {}), ...(botWelcome ? { botWelcomeMessage: botWelcome.messagesArray.join("; "), botWelcomeMultiple: !botWelcome.singleMessage } : {}), ...(welcomeSettings ? { welcomeC: welcomeSettings.channelId, welcomeAvatarPosition: welcomeSettings.avatarPosition, welcomeBackgroundUrl: welcomeSettings.backgroundUrl, leaveC: welcomeSettings.leaveChannelId } : {}) } };
      } catch (err) {
        fastify.log.error(err);
        return reply.code(502).send({ error: "Failed to save guild settings" });
      }
    },
  );
}
