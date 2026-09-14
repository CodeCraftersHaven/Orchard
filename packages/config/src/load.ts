import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Struct } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function load<K extends string>(keys: readonly K[], path?: string, inject?: boolean): Record<K, string>;
export function load<T extends object>(struct: Struct<T>, path?: string, inject?: boolean): T;
export function load(
    structOrKeys: Struct<any> | readonly string[],
    path: string = resolve(__dirname, `../../../.env`),
    inject: boolean = true,
): any {
    const out: any = {};

    if (!existsSync(path)) {
        throw new Error(`Cannot read contents of '${path}': File does not exist`);
    }

    const file = readFileSync(path);
    const lines = file.toString().split('\n');

    const raw: Record<string, string> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...valueParts] = trimmed.split('=');
        if (!key) continue;
        const value = valueParts.join('=').trim();

        const cleanValue = value.replace(/^["']|["']$/g, '');

        raw[key] = cleanValue;
    }

    if (Array.isArray(structOrKeys)) {
        for (const key of structOrKeys) {
            if (!(key in raw)) {
                throw new Error(`Cannot map key '${key}': Key does not exist`);
            }
            out[key] = process.env[key] ?? raw[key];
        }
    } else {
        const struct = structOrKeys as any;
        for (const key in struct) {
            if (!(key in raw)) {
                throw new Error(`Cannot map key '${key}': Key does not exist`);
            }

            out[key] = struct[key](process.env[key] ?? raw[key] as string);
        }
    }

    if (inject) {
        Object.assign(process.env, out);
    }

    return out;
}
