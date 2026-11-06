import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connectOverCDP, kill, launch } = vi.hoisted(() => ({
  connectOverCDP: vi.fn(),
  kill: vi.fn(),
  launch: vi.fn(),
}));

vi.mock("chrome-launcher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("chrome-launcher")>()),
  launch,
}));

vi.mock("playwright-core", () => ({ chromium: { connectOverCDP } }));

import {
  chromeLaunchOptions,
  launchConsoleBrowser,
  normalizePermission,
  upsertEnvValue,
  writeEnvToken,
} from "./browser-bootstrap.js";

const CONSOLE_URL = "https://console.hetzner.cloud";
const CHROME_PORT = 9222;

const temporaryDirectories: string[] = [];

function fakeBrowser(urls: string[], close = vi.fn()) {
  const pages = urls.map((url) => ({ url: () => url }));
  return { close, contexts: () => [{ pages: () => pages }] };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("browser bootstrap helpers", () => {
  describe("normalizePermission", () => {
    it("accepts supported permissions", () => {
      expect(normalizePermission("read")).toBe("read");
      expect(normalizePermission("read-write")).toBe("read-write");
    });

    it("rejects unsupported permissions", () => {
      expect(() => normalizePermission("admin")).toThrow(
        "Permission must be 'read' or 'read-write'."
      );
    });
  });

  describe("upsertEnvValue", () => {
    it("adds a token to an empty env file", () => {
      expect(upsertEnvValue("", "HETZNER_CLOUD_TOKEN", "token")).toBe(
        "HETZNER_CLOUD_TOKEN=token\n"
      );
    });

    it("updates an existing token while keeping other values", () => {
      expect(
        upsertEnvValue(
          "A=1\nHETZNER_CLOUD_TOKEN=old\nB=2\n",
          "HETZNER_CLOUD_TOKEN",
          "new"
        )
      ).toBe("A=1\nHETZNER_CLOUD_TOKEN=new\nB=2\n");
    });
  });

  it("uses browser flags that preserve the Chrome sandbox", () => {
    const options = chromeLaunchOptions(CONSOLE_URL);

    expect(options.ignoreDefaultFlags).toBe(true);
    expect(options.startingUrl).toBe(CONSOLE_URL);
    expect(options.chromeFlags).not.toContain("--no-sandbox");
    expect(options.chromeFlags).toContain("--no-first-run");
  });

  describe("launchConsoleBrowser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      launch.mockResolvedValue({ kill, port: CHROME_PORT });
    });

    it("does not attach automation until asked", async () => {
      await launchConsoleBrowser(CONSOLE_URL);

      expect(launch).toHaveBeenCalledOnce();
      expect(connectOverCDP).not.toHaveBeenCalled();
    });

    it("attaches to the launched browser and prefers the console tab", async () => {
      connectOverCDP.mockResolvedValue(
        fakeBrowser([`${CONSOLE_URL}/projects`, "https://example.com/"])
      );

      const session = await launchConsoleBrowser(CONSOLE_URL);
      const page = await session.attach();

      expect(connectOverCDP).toHaveBeenCalledWith(
        `http://127.0.0.1:${CHROME_PORT}`
      );
      expect(page.url()).toBe(`${CONSOLE_URL}/projects`);
    });

    it("falls back to the newest tab during a login redirect", async () => {
      connectOverCDP.mockResolvedValue(
        fakeBrowser(["about:blank", "https://accounts.hetzner.com/login"])
      );

      const session = await launchConsoleBrowser(CONSOLE_URL);
      const page = await session.attach();

      expect(page.url()).toBe("https://accounts.hetzner.com/login");
    });

    it("reports a closed browser clearly", async () => {
      connectOverCDP.mockRejectedValue(new Error("ECONNREFUSED"));

      const session = await launchConsoleBrowser(CONSOLE_URL);

      await expect(session.attach()).rejects.toThrow(
        "Could not connect to the browser."
      );
    });

    it("reports when every tab was closed", async () => {
      connectOverCDP.mockResolvedValue(fakeBrowser([]));

      const session = await launchConsoleBrowser(CONSOLE_URL);

      await expect(session.attach()).rejects.toThrow("No browser tab is open.");
    });

    it("kills Chrome when closed before attaching", async () => {
      const session = await launchConsoleBrowser(CONSOLE_URL);

      await session.close();

      expect(kill).toHaveBeenCalledOnce();
    });

    it("kills Chrome even if disconnecting fails", async () => {
      connectOverCDP.mockResolvedValue(
        fakeBrowser(
          [CONSOLE_URL],
          vi.fn().mockRejectedValue(new Error("disconnected"))
        )
      );
      const session = await launchConsoleBrowser(CONSOLE_URL);
      await session.attach();

      await expect(session.close()).rejects.toThrow("disconnected");
      expect(kill).toHaveBeenCalledOnce();
    });
  });

  it("restricts an existing env file after writing the token", () => {
    const directory = mkdtempSync(join(tmpdir(), "hctl-env-"));
    temporaryDirectories.push(directory);
    const envFile = join(directory, ".env");
    writeFileSync(envFile, "OTHER=value\n");
    chmodSync(envFile, 0o644);

    writeEnvToken(envFile, "token");

    expect(readFileSync(envFile, "utf8")).toBe(
      "OTHER=value\nHETZNER_CLOUD_TOKEN=token\n"
    );
    expect(statSync(envFile).mode % 0o1000).toBe(0o600);
  });
});
