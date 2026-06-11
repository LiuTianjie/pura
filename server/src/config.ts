import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PuraConfig = {
  hubUrl?: string;
  agentId?: string;
  agentName?: string;
  agentPort?: string;
  publicUrl?: string;
  host?: string;
  dataDir?: string;
};

const configDir = path.join(os.homedir(), ".pura");
const configPath = path.join(configDir, "config.json");

export function readConfig(): PuraConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as PuraConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: PuraConfig) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({ ...readConfig(), ...config }, null, 2)}\n`);
}
