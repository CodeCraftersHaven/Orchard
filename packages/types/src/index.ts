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
    categoryName?: string;
}

export type AvatarPosition = "left" | "middle" | "right";

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
    reactionMessageID: string;
    welcomeC: string;
    welcomeAvatarPosition: AvatarPosition;
    welcomeBackgroundUrl: string;
    botWelcomeMessage: string;
    botWelcomeMultiple: boolean;
    leaveC: string;
    introC: string;
}

export interface GuildSettingsResponse {
    guild: Partial<GuildSettings> & Pick<GuildSettings, "gID" | "gName">;
    channels: GuildChannel[];
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