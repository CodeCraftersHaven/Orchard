import { load } from "./load.js";
import { CONFIG_KEYS } from "./constants.js";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = resolve(projectRoot, ".env");
const fallbackPath = existsSync(envPath) ? envPath : resolve(projectRoot, ".env");

export const env = load(CONFIG_KEYS, fallbackPath, true);

if (env.NODE_ENV !== "development" && env.NODE_ENV !== "production") {
    throw new Error(`NODE_ENV must be development or production, received '${env.NODE_ENV}'`);
}