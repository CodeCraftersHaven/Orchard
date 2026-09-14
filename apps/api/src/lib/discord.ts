import { env } from "@orchard/config";
import type {
  DiscordChannel,
  DiscordGuild,
  DiscordUser,
  TokenResponse,
} from "@orchard/types";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = 0x8n;

async function discordFetch<T>(path: string, token: string, tokenType = "Bearer"): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `${tokenType} ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord API ${path} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}

export function getAuthorizeUrl(state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  return url.toString();
}

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export function exchangeCodeForToken(code: string) {
  return exchangeToken(
    new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  );
}

export function refreshAccessToken(refreshToken: string) {
  return exchangeToken(
    new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export function getCurrentUser(accessToken: string) {
  return discordFetch<DiscordUser>("/users/@me", accessToken);
}

export function getCurrentUserGuilds(accessToken: string) {
  return discordFetch<DiscordGuild[]>("/users/@me/guilds", accessToken);
}

export function getBotGuildChannels(guildId: string) {
  return discordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`, env.DISCORD_TOKEN, "Bot");
}

export async function checkBotHealth() {
  const startedAt = Date.now();
  try {
    await discordFetch<DiscordUser>("/users/@me", env.DISCORD_TOKEN, "Bot");
    return { status: "up" as const, latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "down" as const, latencyMs: Date.now() - startedAt };
  }
}

export function hasAdministratorPermission(guild: DiscordGuild) {
  if (guild.owner) return true;
  try {
    return (BigInt(guild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

// Guilds the bot itself is a member of, cached briefly to avoid hammering Discord's rate limits.
let botGuildsCache: { ids: Set<string>; expiresAt: number } | null = null;
const BOT_GUILDS_TTL_MS = 60_000;

export async function getBotGuildIds(): Promise<Set<string>> {
  if (botGuildsCache && botGuildsCache.expiresAt > Date.now()) {
    return botGuildsCache.ids;
  }

  const guilds = await discordFetch<DiscordGuild[]>("/users/@me/guilds", env.DISCORD_TOKEN, "Bot");
  const ids = new Set(guilds.map((g) => g.id));
  botGuildsCache = { ids, expiresAt: Date.now() + BOT_GUILDS_TTL_MS };
  return ids;
}

export function guildIconUrl(guild: Pick<DiscordGuild, "id" | "icon">) {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}`;
}

export function getBotInviteUrl(guildId: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", "8");
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");
  return url.toString();
}
