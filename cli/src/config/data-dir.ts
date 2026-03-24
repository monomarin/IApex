import path from "node:path";
import {
  expandHomePrefix,
  resolveDefaultConfigPath,
  resolveDefaultContextPath,
  resolveIApexInstanceId,
} from "./home.js";

export interface DataDirOptionLike {
  dataDir?: string;
  config?: string;
  context?: string;
  instance?: string;
}

export interface DataDirCommandSupport {
  hasConfigOption?: boolean;
  hasContextOption?: boolean;
}

export function applyDataDirOverride(
  options: DataDirOptionLike,
  support: DataDirCommandSupport = {},
): string | null {
  const rawDataDir = options.dataDir?.trim();
  if (!rawDataDir) return null;

  const resolvedDataDir = path.resolve(expandHomePrefix(rawDataDir));
  process.env.IApex_HOME = resolvedDataDir;

  if (support.hasConfigOption) {
    const hasConfigOverride =
      Boolean(options.config?.trim()) ||
      Boolean(process.env.IAPEX_CONFIG?.trim()) ||
      Boolean(process.env.IApex_CONFIG?.trim());
    if (!hasConfigOverride) {
      const instanceId = resolveIApexInstanceId(options.instance);
      process.env.IApex_INSTANCE_ID = instanceId;
      process.env.IApex_CONFIG = resolveDefaultConfigPath(instanceId);
    }
  }

  if (support.hasContextOption) {
    const hasContextOverride = Boolean(options.context?.trim()) || Boolean(process.env.IApex_CONTEXT?.trim());
    if (!hasContextOverride) {
      process.env.IApex_CONTEXT = resolveDefaultContextPath();
    }
  }

  return resolvedDataDir;
}
