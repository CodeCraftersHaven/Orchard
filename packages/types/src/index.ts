export interface SessionPayload {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
    fingerprint: string;
    accessToken: string;
    refreshToken: string;
}

export interface PartialGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
    bot_present?: boolean;
}

export interface DiscordUser {
    id: string;
    username: string;
    global_name: string | null;
    discriminator: string;
    avatar: string | null;
}

export interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

export interface DiscordChannel {
    id: string;
    name: string;
    type: number;
    parent_id: string | null;
    position?: number;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

export interface Me {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
}

export interface Guild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    administrator: boolean;
    botInGuild: boolean;
    inviteUrl: string | null;
}

export interface GuildChannel {
    id: string;
    name: string;
    type: number;
    parent_id: string | null;
    position?: number;
    categoryName?: string;
}

export interface GuildRole {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

export interface ReactionRoleEntry {
    id: string;
    roleId: string;
    emoji: string;
    roleName?: string;
}

export interface ReactionRolePanel {
    id: string;
    gID: string;
    messageId: string;
    channelId: string;
    title: string;
    description: string;
    entries: ReactionRoleEntry[];
}

export interface ReactionRoleResponse {
    panels: ReactionRolePanel[];
    channels: GuildChannel[];
    roles: GuildRole[];
}

export interface EconomyItemDefinition {
    id: string;
    serverId: string;
    item: string;
    game: "scavenger-hunt" | "fishing" | "farming";
    value: number;
}

export type AvatarPosition = "left" | "middle" | "right";
export type WelcomeMode = "text" | "embed" | "image" | "container";

export interface GuildSettings {
    gID: string;
    gName: string;
    announcementsChannelId: string;
    rolesChannelId: string;
    modC: string;
    birthdayAnnounceChan: string;
    birthdayEnabled: boolean;
    countingChannel: string;
    countingEnabled: boolean;
    birthdayLogChannelId: string;
    gamingChannelId: string;
    taskLogsChannelId: string;
    verifiedRole: string;
    nonVerifiedRoleId: string;
    reactionMessageID: string;
    welcomeC: string;
    welcomeAvatarPosition: AvatarPosition;
    welcomeBackgroundUrl: string;
    welcomeMode: WelcomeMode;
    welcomeEmbedTitle: string;
    welcomeEmbedDescription: string;
    welcomeEmbedColor: string;
    welcomeEmbedAuthor: string;
    welcomeEmbedTimestamp: boolean;
    welcomeEmbedFields: string;
    welcomeContainerExtraText: string;
    welcomeContainerImageUrl: string;
    welcomeContainerGalleryUrls: string;
    welcomeContainerSeparators: boolean;
    botWelcomeMessage: string;
    botWelcomeMultiple: boolean;
    economyCurrencyName: string;
    economyBankName: string;
    economyCurrencyImageUrl: string;
    economyBankImageUrl: string;
    leaveC: string;
    leaveEnabled: boolean;
    introC: string;
    levelEnabled: boolean;
    levelChannel?: string;
    levelFirstReward: number;
    levelSecondReward: number;
    levelThirdReward: number;
    levelParticipantReward: number;
    statsAllChannel: string;
    statsUsersChannel: string;
    statsBotsChannel: string;
    statsCategoryId: string;
    statsCreateMissing?: boolean;
    statsAllName?: string;
    statsUsersName?: string;
    statsBotsName?: string;
    statsPlacement?: string;
    verificationChannelId: string;
    verificationPanelMessageId: string;
}

export interface GuildSettingsResponse {
    guild: Partial<GuildSettings> & Pick<GuildSettings, "gID" | "gName">;
    channels: GuildChannel[];
    roles: GuildRole[];
}

export interface OrchardStats {
    watchedServers: number;
    authorizedUsers: number;
    watchedMembers: number;
}

export interface HealthResponse {
    status: "healthy" | "degraded";
    timestamp: string;
    checks: {
        api: { status: "up" };
        bot: { status: "up" | "down"; latencyMs: number };
        database: { status: "up" | "down"; latencyMs: number };
    };
}