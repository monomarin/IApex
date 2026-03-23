import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { IApexConfig } from "../config/schema.js";
import { addAllowedHostname } from "../commands/allowed-hostname.js";

function createTempConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "IApex-allowed-hostname-"));
  return path.join(dir, "config.json");
}

function writeBaseConfig(configPath: string) {
  const base: IApexConfig = {
    $meta: {
      version: 1,
      updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      source: "configure",
    },
    database: {
      mode: "embedded-postgres",
      embeddedPostgresDataDir: "/tmp/IApex-db",
      embeddedPostgresPort: 54329,
      backup: {
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        dir: "/tmp/IApex-backups",
      },
    },
    logging: {
      mode: "file",
      logDir: "/tmp/IApex-logs",
    },
    server: {
      deploymentMode: "authenticated",
      exposure: "private",
      host: "0.0.0.0",
      port: 3100,
      allowedHostnames: [],
      serveUi: true,
    },
    auth: {
      baseUrlMode: "auto",
      disableSignUp: false,
    },
    storage: {
      provider: "local_disk",
      localDisk: { baseDir: "/tmp/IApex-storage" },
      s3: {
        bucket: "IApex",
        region: "us-east-1",
        prefix: "",
        forcePathStyle: false,
      },
    },
    secrets: {
      provider: "local_encrypted",
      strictMode: false,
      localEncrypted: { keyFilePath: "/tmp/IApex-secrets/master.key" },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(base, null, 2));
}

describe("allowed-hostname command", () => {
  it("adds and normalizes hostnames", async () => {
    const configPath = createTempConfigPath();
    writeBaseConfig(configPath);

    await addAllowedHostname("https://Dotta-MacBook-Pro:3100", { config: configPath });
    await addAllowedHostname("dotta-macbook-pro", { config: configPath });

    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as IApexConfig;
    expect(raw.server.allowedHostnames).toEqual(["dotta-macbook-pro"]);
  });
});
