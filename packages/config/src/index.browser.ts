import { CONFIG_KEYS } from "./constants.js";

const out: any = {};
const source = (import.meta as any).env || {};

for (const key of CONFIG_KEYS) {
    out[key] = source[key] || source[`VITE_${key}`];
}

if (typeof process !== 'undefined' && (process as any).env) {
    for (const key of CONFIG_KEYS) {
        if (!out[key]) out[key] = (process as any).env[key];
    }
}

export const env = out;
