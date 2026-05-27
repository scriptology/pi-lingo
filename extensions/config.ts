import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface LingoConfig {
  targetLanguage: string;
}

export interface LingoState {
  targetLanguage: string;
  isActive: boolean;
}

const CONFIG_FILE = "lingo.json";

function getConfigPath(): string {
  return join(getAgentDir(), CONFIG_FILE);
}

export function loadConfig(): LingoConfig {
  const path = getConfigPath();
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf-8")) as Partial<LingoConfig>;
      return {
        targetLanguage: typeof data.targetLanguage === "string" && data.targetLanguage
          ? data.targetLanguage
          : "en",
      };
    } catch {
      // ignore parse errors, fallback to defaults
    }
  }
  return { targetLanguage: "en" };
}

export function saveConfig(cfg: LingoConfig): void {
  const dir = getAgentDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function createState(config: LingoConfig): LingoState {
  return { targetLanguage: config.targetLanguage, isActive: false };
}
