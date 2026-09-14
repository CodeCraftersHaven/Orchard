import type {
  Guild,
  GuildSettings,
  GuildSettingsResponse,
  HealthResponse,
  Me,
  OrchardStats,
} from "@orchard/types";

export type {
  Guild,
  GuildChannel,
  GuildSettings,
  GuildSettingsResponse,
  HealthResponse,
  Me,
  OrchardStats,
} from "@orchard/types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY = "orchard_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const pendingGets = new Map<string, Promise<unknown>>();

export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (init.method ?? "GET").toUpperCase();
  const requestKey = `${method}:${path}:${token ?? ""}`;
  if (method === "GET") {
    const pending = pendingGets.get(requestKey);
    if (pending) return pending as Promise<T>;
  }

  const request = fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 401) clearToken();
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? `Request failed with ${res.status}`, res.status);
    }

    return res.json() as Promise<T>;
  });

  if (method === "GET") {
    pendingGets.set(requestKey, request);
    request.then(
      () => pendingGets.delete(requestKey),
      () => pendingGets.delete(requestKey),
    );
  }

  return request;
}

export const getMe = () => apiFetch<Me>("/auth/me");
export const getGuilds = () => apiFetch<Guild[]>("/guilds");

export const getGuildSettings = (guildId: string) => apiFetch<GuildSettingsResponse>(`/guilds/${guildId}/settings`);
export const saveGuildSettings = (guildId: string, settings: Partial<GuildSettings>) =>
  apiFetch<{ guild: GuildSettings }>(`/guilds/${guildId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
export const getOrchardStats = () => apiFetch<OrchardStats>("/stats");
export const getHealth = () => apiFetch<HealthResponse>("/health");
export const discordLoginUrl = () => `${API_BASE_URL}/auth/discord/login`;
export function avatarUrl(user: Me) {
  if (!user.avatar) {
    const index = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
}
