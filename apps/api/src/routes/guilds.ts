import type { FastifyInstance } from "fastify";
import {
  getBotGuildIds,
  getBotGuildChannels,
  getBotGuildRoles,
  createBotVoiceChannel,
  createBotCategory,
  setBotChannelParent,
  positionBotChannel,
  updateBotChannelPermissions,
  getBotInviteUrl,
  getCurrentUserGuilds,
  hasAdministratorPermission,
  guildIconUrl,
  createBotEmbedMessage,
} from "../lib/discord.js";

const channelFieldLabels: Record<string, string> = {
  welcomeC: "Welcome messages",
  leaveC: "Leave messages",
  introC: "Introductions",
  announcementsChannelId: "Announcements",
  birthdayAnnounceChan: "Birthday announcements",
  birthdayLogChannelId: "Birthday logs",
  taskLogsChannelId: "Task logs",
  gamingChannelId: "Gaming",
  modC: "Moderation",
  countingChannel: "Counting channel",
  rolesChannelId: "Roles",
};

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

        const [guild, birthday, counter, welcome, botWelcome, economy, levelSettings, stats, channels, roles] = await Promise.all([
          fastify.prisma.guild.findUnique({ where: { gID: guildId } }),
          fastify.prisma.birthday.findUnique({ where: { gID: guildId }, include: { settings: true } }),
          fastify.prisma.counter.findUnique({ where: { gID: guildId } }),
          fastify.prisma.welcomeSettings.findUnique({ where: { gID: guildId } }),
          fastify.prisma.botWelcomeMessages.findUnique({ where: { gID: guildId } }),
          fastify.prisma.economySettings.findUnique({ where: { gID: guildId } }),
          fastify.prisma.levelSettings.findUnique({ where: { gID: guildId } }),
          fastify.prisma.serverStats.findUnique({ where: { gID: guildId } }),
          getBotGuildChannels(guildId),
          getBotGuildRoles(guildId),
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
            welcomeMode: ["text", "embed", "image", "container"].includes(welcome?.mode ?? "") ? welcome?.mode : "image",
            welcomeEmbedTitle: welcome?.embedTitle ?? "",
            welcomeEmbedDescription: welcome?.embedDescription ?? "",
            welcomeEmbedColor: welcome?.embedColor ?? "#5865F2",
            welcomeEmbedAuthor: welcome?.embedAuthor ?? "",
            welcomeEmbedTimestamp: welcome?.embedTimestamp ?? false,
            welcomeEmbedFields: welcome?.embedFields ?? "[]",
            welcomeContainerExtraText: welcome?.containerExtraText ?? "",
            welcomeContainerImageUrl: welcome?.containerImageUrl ?? "",
            welcomeContainerGalleryUrls: welcome?.containerGalleryUrls ?? "",
            welcomeContainerSeparators: welcome?.containerSeparators ?? true,
            botWelcomeMessage: botWelcome?.messagesArray.join("; ") ?? "",
            botWelcomeMultiple: botWelcome ? !botWelcome.singleMessage : false,
            economyCurrencyName: economy?.currencyName ?? "Coins",
            economyBankName: economy?.bankName ?? "Bank",
            economyCurrencyImageUrl: economy?.currencyImageUrl ?? "",
            economyBankImageUrl: economy?.bankImageUrl ?? "",
            leaveC: guild?.leaveChannelId ?? "",
            leaveEnabled: guild?.leaveEnabled ?? false,
            levelEnabled: levelSettings?.enabled ?? false,
            levelFirstReward: levelSettings?.firstReward ?? 1200,
            levelSecondReward: levelSettings?.secondReward ?? 900,
            levelThirdReward: levelSettings?.thirdReward ?? 700,
            levelParticipantReward: levelSettings?.participantReward ?? 100,
            statsAllChannel: stats?.allCountChan ?? "",
            statsUsersChannel: stats?.userCountChan ?? "",
            statsBotsChannel: stats?.botCountChan ?? "",
            statsCategoryId: stats?.categoryId ?? "",
          },
          channels: channels
            .map((channel) => ({
              ...channel,
              categoryName: channel.parent_id
                ? channels.find((parent) => parent.id === channel.parent_id && parent.type === 4)?.name
                : undefined,
            })),
          roles: roles.filter((role) => !role.managed),
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
        "levelEnabled", "levelFirstReward", "levelSecondReward", "levelThirdReward", "levelParticipantReward",
        "birthdayLogChannelId", "gamingChannelId", "taskLogsChannelId", "verifiedRole",
        "reactionMessageID", "welcomeC", "welcomeAvatarPosition", "welcomeBackgroundUrl", "welcomeMode", "welcomeEmbedTitle", "welcomeEmbedDescription", "welcomeEmbedColor", "welcomeEmbedAuthor", "welcomeEmbedTimestamp", "welcomeEmbedFields", "welcomeContainerExtraText", "welcomeContainerImageUrl", "welcomeContainerGalleryUrls", "welcomeContainerSeparators", "leaveC", "introC",
        "botWelcomeMessage", "botWelcomeMultiple",
        "economyCurrencyName", "economyBankName", "economyCurrencyImageUrl", "economyBankImageUrl",
        "statsAllChannel", "statsUsersChannel", "statsBotsChannel", "statsCategoryId",
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

        const [previousGuild, previousCounter, previousBirthday, previousWelcome] = await Promise.all([
          fastify.prisma.guild.findUnique({ where: { gID: guildId } }),
          fastify.prisma.counter.findUnique({ where: { gID: guildId } }),
          fastify.prisma.birthday.findUnique({ where: { gID: guildId }, include: { settings: true } }),
          fastify.prisma.welcomeSettings.findUnique({ where: { gID: guildId } }),
        ]);
        const previousChannelValues: Record<string, string> = {
          welcomeC: previousWelcome?.channelId ?? "",
          leaveC: previousGuild?.leaveChannelId ?? "",
          introC: previousGuild?.introC ?? "",
          announcementsChannelId: previousGuild?.announcementsChannelId ?? "",
          birthdayAnnounceChan: previousBirthday?.settings.announceChannelId ?? "",
          birthdayLogChannelId: previousBirthday?.settings.logChannelId ?? "",
          taskLogsChannelId: previousGuild?.taskLogsChannelId ?? "",
          gamingChannelId: previousGuild?.gamingChannelId ?? "",
          modC: previousGuild?.modC ?? "",
          countingChannel: previousCounter?.channel ?? "",
          rolesChannelId: previousGuild?.rolesChannelId ?? "",
        };

        const data = Object.fromEntries(
          editableFields
            .filter((field) => {
              if (field === "birthdayEnabled") return typeof request.body?.[field] === "boolean";
              if (field === "countingEnabled") return typeof request.body?.[field] === "boolean";
              if (field === "levelEnabled") return typeof request.body?.[field] === "boolean";
              if (field === "welcomeEmbedTimestamp" || field === "welcomeContainerSeparators") return typeof request.body?.[field] === "boolean";
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
        const levelData: { enabled?: boolean; firstReward?: number; secondReward?: number; thirdReward?: number; participantReward?: number } = {};
        if (typeof request.body?.levelEnabled === "boolean") levelData.enabled = request.body.levelEnabled;
        if (typeof request.body?.levelFirstReward === "number") levelData.firstReward = Math.max(0, request.body.levelFirstReward);
        if (typeof request.body?.levelSecondReward === "number") levelData.secondReward = Math.max(0, request.body.levelSecondReward);
        if (typeof request.body?.levelThirdReward === "number") levelData.thirdReward = Math.max(0, request.body.levelThirdReward);
        if (typeof request.body?.levelParticipantReward === "number") levelData.participantReward = Math.max(0, request.body.levelParticipantReward);
        const statsData: { allCountChan?: string; userCountChan?: string; botCountChan?: string; categoryId?: string } = {};
        if (typeof data.statsAllChannel === "string") statsData.allCountChan = data.statsAllChannel;
        if (typeof data.statsUsersChannel === "string") statsData.userCountChan = data.statsUsersChannel;
        if (typeof data.statsBotsChannel === "string") statsData.botCountChan = data.statsBotsChannel;
        if (typeof data.statsCategoryId === "string") statsData.categoryId = data.statsCategoryId;
        if (request.body?.statsCreateMissing === true || statsData.categoryId || typeof request.body?.statsPlacement === "string") {
          const names = {
            all: typeof request.body.statsAllName === "string" && request.body.statsAllName.trim() ? request.body.statsAllName.trim() : "All",
            users: typeof request.body.statsUsersName === "string" && request.body.statsUsersName.trim() ? request.body.statsUsersName.trim() : "Users",
            bots: typeof request.body.statsBotsName === "string" && request.body.statsBotsName.trim() ? request.body.statsBotsName.trim() : "Bots",
          };
          const overwrites = [
            { id: guildId, allow: "1024", deny: "1048576" },
            ...(typeof previousGuild?.nonVerifiedRoleId === "string" && previousGuild.nonVerifiedRoleId ? [{ id: previousGuild.nonVerifiedRoleId, deny: "1025024" }] : []),
            ...(typeof previousGuild?.verifiedRole === "string" && previousGuild.verifiedRole ? [{ id: previousGuild.verifiedRole, allow: "1024", deny: "1048576" }] : []),
          ];
          const existingStats = await fastify.prisma.serverStats.findUnique({ where: { gID: guildId } });
          const statsCategory = statsData.categoryId || existingStats?.categoryId
            ? statsData.categoryId || existingStats?.categoryId!
            : (await createBotCategory(guildId, "server stats", overwrites)).id;
          const channelId = async (current: string | undefined, name: string) => current || (await createBotVoiceChannel(guildId, name, overwrites)).id;
          statsData.allCountChan = await channelId(statsData.allCountChan || existingStats?.allCountChan, "Total Members: 0");
          statsData.userCountChan = await channelId(statsData.userCountChan || existingStats?.userCountChan, "Users: 0");
          statsData.botCountChan = await channelId(statsData.botCountChan || existingStats?.botCountChan, "Bots: 0");
          await Promise.all([statsData.allCountChan, statsData.userCountChan, statsData.botCountChan].map((id) => id ? setBotChannelParent(id, statsCategory) : Promise.resolve()));
          statsData.categoryId = statsCategory;
          const placement = typeof request.body?.statsPlacement === "string" ? request.body.statsPlacement : "";
          if (placement) {
            const [direction, anchorId] = placement.split(":");
            const channels = await getBotGuildChannels(guildId);
            const anchor = channels.find(channel => channel.id === anchorId);
            if (anchor && (direction === "before" || direction === "after")) {
              const anchorPosition = anchor.position ?? 0;
              const targetPosition = direction === "before"
                ? Math.max(0, anchorPosition - 1)
                : anchorPosition + 1;
              await positionBotChannel(guildId, statsCategory, targetPosition);
            }
          }
          await Promise.all([statsData.allCountChan, statsData.userCountChan, statsData.botCountChan].map((id) => id ? updateBotChannelPermissions(id, overwrites) : Promise.resolve()));
        }
        const welcomeData: Record<string, unknown> = Object.fromEntries(
          Object.entries(data)
            .filter(([field]) => field === "welcomeC" || field === "welcomeAvatarPosition" || field === "welcomeBackgroundUrl" || field === "welcomeMode" || field.startsWith("welcomeEmbed") || field.startsWith("welcomeContainer"))
            .map(([field, value]) => [
              { welcomeC: "channelId", welcomeAvatarPosition: "avatarPosition", welcomeBackgroundUrl: "backgroundUrl", welcomeMode: "mode", welcomeEmbedTitle: "embedTitle", welcomeEmbedDescription: "embedDescription", welcomeEmbedColor: "embedColor", welcomeEmbedAuthor: "embedAuthor", welcomeEmbedTimestamp: "embedTimestamp", welcomeEmbedFields: "embedFields", welcomeContainerExtraText: "containerExtraText", welcomeContainerImageUrl: "containerImageUrl", welcomeContainerGalleryUrls: "containerGalleryUrls", welcomeContainerSeparators: "containerSeparators" }[field],
              value,
            ]),
        );
        if (welcomeData.mode !== "text" && welcomeData.mode !== "embed" && welcomeData.mode !== "image" && welcomeData.mode !== "container") delete welcomeData.mode;
        if (typeof welcomeData.embedColor === "string" && !/^#[0-9A-Fa-f]{6}$/.test(welcomeData.embedColor)) delete welcomeData.embedColor;
        if (typeof welcomeData.embedFields === "string") {
          try { JSON.parse(welcomeData.embedFields); } catch { delete welcomeData.embedFields; }
        }
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
        const economyFields = ["economyCurrencyName", "economyBankName", "economyCurrencyImageUrl", "economyBankImageUrl"] as const;
        const economyData = Object.fromEntries(economyFields.map((field) => [
          { economyCurrencyName: "currencyName", economyBankName: "bankName", economyCurrencyImageUrl: "currencyImageUrl", economyBankImageUrl: "bankImageUrl" }[field],
          request.body[field] as string,
        ]).filter(([, value]) => typeof value === "string"));
        const guildData: Record<string, unknown> = Object.fromEntries(
          Object.entries(data).filter(([field]) => ![
            "birthdayAnnounceChan", "birthdayLogChannelId", "welcomeC", "welcomeAvatarPosition", "welcomeBackgroundUrl", "welcomeMode", "welcomeEmbedTitle", "welcomeEmbedDescription", "welcomeEmbedColor", "welcomeEmbedAuthor", "welcomeEmbedTimestamp", "welcomeEmbedFields", "welcomeContainerExtraText", "welcomeContainerImageUrl", "welcomeContainerGalleryUrls", "welcomeContainerSeparators", "leaveC",
            "birthdayEnabled", "countingChannel", "countingEnabled",
            "levelEnabled", "levelFirstReward", "levelSecondReward", "levelThirdReward", "levelParticipantReward",
            "botWelcomeMessage", "botWelcomeMultiple",
            "economyCurrencyName", "economyBankName", "economyCurrencyImageUrl", "economyBankImageUrl",
            "statsAllChannel", "statsUsersChannel", "statsBotsChannel", "statsCategoryId",
          ].includes(field)),
        );
        if (typeof data.leaveC === "string") {
          // Leave is enabled/disabled purely based on whether a channel is selected.
          guildData.leaveChannelId = data.leaveC;
          guildData.leaveEnabled = data.leaveC !== "";
        }
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
        const economySettings = Object.keys(economyData).length
          ? await fastify.prisma.economySettings.upsert({
            where: { gID: guildId },
            create: { gID: guildId, ...economyData },
            update: economyData,
          })
          : null;
        const levelSettingsUpdated = Object.keys(levelData).length
          ? await fastify.prisma.levelSettings.upsert({
            where: { gID: guildId },
            create: { gID: guildId, ...levelData },
            update: levelData,
          })
          : null;
        const serverStats = Object.keys(statsData).length
          ? await fastify.prisma.serverStats.upsert({ where: { gID: guildId }, create: { gID: guildId, allCount: 0, userCount: 0, botCount: 0, ...statsData }, update: statsData })
          : null;
        if (serverStats) {
          const statsOverwrites = [
            { id: guildId, allow: "1024", deny: "1048576" },
            ...(previousGuild?.nonVerifiedRoleId ? [{ id: previousGuild.nonVerifiedRoleId, deny: "1025024" }] : []),
            ...(previousGuild?.verifiedRole ? [{ id: previousGuild.verifiedRole, allow: "1024", deny: "1048576" }] : []),
          ];
          await Promise.all([serverStats.allCountChan, serverStats.userCountChan, serverStats.botCountChan].filter(Boolean).map((channelId) => updateBotChannelPermissions(channelId, statsOverwrites)));
        }

        // Notify each newly-selected channel that it now backs that system.
        for (const [field, label] of Object.entries(channelFieldLabels)) {
          const newChannelId = data[field];
          if (typeof newChannelId !== "string" || !newChannelId || newChannelId === previousChannelValues[field]) continue;
          try {
            await createBotEmbedMessage(newChannelId, `${label} channel set`, `This channel has been set as the **${label}** channel for this server.`);
          } catch (err) {
            fastify.log.error(err, `Failed to post channel-set panel for ${field}`);
          }
        }

        return { guild: { ...guild, ...data, leaveC: guild.leaveChannelId, leaveEnabled: guild.leaveEnabled, ...(birthdaySettings ? { birthdayAnnounceChan: birthdaySettings.announceChannelId, birthdayLogChannelId: birthdaySettings.logChannelId } : {}), ...(counter ? { countingChannel: counter.channel, countingEnabled: counter.active } : {}), ...(serverStats ? { statsAllChannel: serverStats.allCountChan, statsUsersChannel: serverStats.userCountChan, statsBotsChannel: serverStats.botCountChan, statsCategoryId: serverStats.categoryId } : {}), ...(botWelcome ? { botWelcomeMessage: botWelcome.messagesArray.join("; "), botWelcomeMultiple: !botWelcome.singleMessage } : {}), ...(economySettings ? { economyCurrencyName: economySettings.currencyName, economyBankName: economySettings.bankName, economyCurrencyImageUrl: economySettings.currencyImageUrl, economyBankImageUrl: economySettings.bankImageUrl } : {}), ...(welcomeSettings ? { welcomeC: welcomeSettings.channelId, welcomeAvatarPosition: welcomeSettings.avatarPosition, welcomeBackgroundUrl: welcomeSettings.backgroundUrl, welcomeMode: welcomeSettings.mode, welcomeEmbedTitle: welcomeSettings.embedTitle, welcomeEmbedDescription: welcomeSettings.embedDescription, welcomeEmbedColor: welcomeSettings.embedColor } : {}), ...(levelSettingsUpdated ? { levelEnabled: levelSettingsUpdated.enabled } : {}) } };
      } catch (err) {
        fastify.log.error(err);
        return reply.code(502).send({ error: "Failed to save guild settings" });
      }
    },
  );

  fastify.delete<{ Params: { guildId: string; system: string } }>(
    "/:guildId/systems/:system",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { guildId, system } = request.params;
      try {
        const userGuilds = await getCurrentUserGuilds(request.user.accessToken);
        const userGuild = userGuilds.find((guild) => guild.id === guildId);
        if (!userGuild || !hasAdministratorPermission(userGuild)) return reply.code(403).send({ error: "Administrator permissions are required." });
        if (!(await getBotGuildIds()).has(guildId)) return reply.code(409).send({ error: "The bot is not in this server." });

        await fastify.prisma.$transaction(async (transaction) => {
          await transaction.systemSetupPanel.deleteMany({ where: { gID: guildId, system } });
          if (system === "welcome") await transaction.welcomeSettings.deleteMany({ where: { gID: guildId } });
          if (system === "birthdays") {
            await transaction.birthdaySubscription.deleteMany({ where: { gID: guildId } });
            const birthday = await transaction.birthday.findUnique({ where: { gID: guildId }, select: { settingsId: true } });
            if (birthday) {
              await transaction.birthday.delete({ where: { gID: guildId } });
              await transaction.birthdaySettings.delete({ where: { gID: birthday.settingsId } });
            }
          }
          if (system === "counting") {
            await transaction.countingUser.deleteMany({ where: { counterId: guildId } });
            await transaction.counter.deleteMany({ where: { gID: guildId } });
          }
          if (system === "serverStats") await transaction.serverStats.deleteMany({ where: { gID: guildId } });
          if (system === "leveling") await transaction.levelSettings.deleteMany({ where: { gID: guildId } });
          if (system === "reactionRoles") await transaction.reactionRole.deleteMany({ where: { gID: guildId } });
          if (system === "economy") {
            await transaction.economyListing.deleteMany({ where: { serverId: guildId } });
            await transaction.economyItemDefinition.deleteMany({ where: { serverId: guildId } });
            await transaction.economyFarmPlot.deleteMany({ where: { serverId: guildId } });
            await transaction.economyCraftJob.deleteMany({ where: { serverId: guildId } });
            await transaction.economyBoost.deleteMany({ where: { serverId: guildId } });
            await transaction.economyGameSession.deleteMany({ where: { serverId: guildId } });
            await transaction.economySettings.deleteMany({ where: { gID: guildId } });
          }
          if (system === "community") {
            await transaction.guild.update({ where: { gID: guildId }, data: { announcementsChannelId: "", rolesChannelId: "", modC: "", gamingChannelId: "", taskLogsChannelId: "", introC: "" } });
          }
        });
        return { deleted: true, system };
      } catch (err) {
        fastify.log.error(err);
        return reply.code(502).send({ error: "Failed to disable system" });
      }
    },
  );
}
