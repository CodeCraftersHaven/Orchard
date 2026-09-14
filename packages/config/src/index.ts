import { load } from "./load.js";
import { CONFIG_KEYS } from "./constants.js";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const env = load(CONFIG_KEYS, resolve(projectRoot, ".env"), true);
const mode = env.NODE_ENV;

if (mode !== "development" && mode !== "production") {
    throw new Error(`NODE_ENV must be development or production, received '${mode}'`);
}