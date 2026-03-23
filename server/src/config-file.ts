import fs from "node:fs";
import { IApexConfigSchema, type IApexConfig } from "@iapexai/shared";
import { resolveIApexConfigPath } from "./paths.js";

export function readConfigFile(): IApexConfig | null {
  const configPath = resolveIApexConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return IApexConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
