import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@iapexai/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const IApexKey = "IApexai/IApex/IApex";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured IApex skills for workspace injection on the next run", async () => {
    const codexHome = await makeTempDir("IApex-codex-skill-sync-");
    cleanupDirs.add(codexHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        IApexSkillSync: {
          desiredSkills: [IApexKey],
        },
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(IApexKey);
    expect(before.entries.find((entry) => entry.key === IApexKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === IApexKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === IApexKey)?.detail).toContain(".agents/skills");
  });

  it("does not persist IApex skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("IApex-codex-skill-prune-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        IApexSkillSync: {
          desiredSkills: [IApexKey],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [IApexKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.entries.find((entry) => entry.key === IApexKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "IApex"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps required bundled IApex skills configured even when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("IApex-codex-skill-required-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        IApexSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, []);
    expect(after.desiredSkills).toContain(IApexKey);
    expect(after.entries.find((entry) => entry.key === IApexKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat IApex skill refs before reporting configured state", async () => {
    const codexHome = await makeTempDir("IApex-codex-legacy-skill-sync-");
    cleanupDirs.add(codexHome);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        IApexSkillSync: {
          desiredSkills: ["IApex"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(IApexKey);
    expect(snapshot.desiredSkills).not.toContain("IApex");
    expect(snapshot.entries.find((entry) => entry.key === IApexKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "IApex")).toBeUndefined();
  });
});
