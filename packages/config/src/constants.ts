export const CONFIG_KEYS = [
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
    'BASE_URL',
    'DISCORD_REDIRECT_URI',
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'API_BASE_URL',
    'API_PORT',
    'DASH_PORT',
    'OWNER_IDS',
    'DEFAULT_PREFIX',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export type Struct<T extends object> = {
    [P in keyof T]: (str: string) => T[P];
};
