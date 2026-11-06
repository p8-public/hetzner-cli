import { Command } from "commander";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

vi.mock("./config.js", () => ({
  requireCredentials: vi.fn(),
}));

vi.mock("../robot/client.js", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
  HetznerRobotClient: vi.fn(function () {
    // mock constructor
  }),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

vi.mock("./formatter.js", () => ({
  error: vi.fn((msg: string) => `ERROR: ${msg}`),
  formatJson: vi.fn((data: unknown) => JSON.stringify(data, null, 2)),
}));

import { confirm } from "@inquirer/prompts";
import { HetznerRobotClient } from "../robot/client.js";
import { asyncAction, confirmAction, output } from "./helpers.js";

/** Run an action the way the CLI does: real parsing, with root-level flags. */
async function runCli(
  action: Parameters<Command["action"]>[0],
  argv: string[]
): Promise<void> {
  const program = new Command()
    .option("-u, --user <username>")
    .option("-p, --password <password>")
    .option("--json");
  program
    .command("thing")
    .command("show [id]")
    .option("-y, --yes")
    .action(action);
  await program.parseAsync(argv, { from: "user" });
}

const mockConfirm = vi.mocked(confirm);
const mockHetznerRobotClient = vi.mocked(HetznerRobotClient);

describe("shared/helpers", () => {
  let mockExit: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("asyncAction", () => {
    it("should create client with flag credentials and call fn", async () => {
      const mockClient = { _id: "test" } as unknown as HetznerRobotClient;
      // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
      mockHetznerRobotClient.mockImplementation(function () {
        return mockClient;
      });

      const fn = vi.fn().mockResolvedValue(undefined);
      await runCli(asyncAction(fn), [
        "-u",
        "flag-user",
        "-p",
        "flag-pass",
        "thing",
        "show",
      ]);

      expect(mockHetznerRobotClient).toHaveBeenCalledWith(
        "flag-user",
        "flag-pass"
      );
      expect(fn).toHaveBeenCalledWith(
        mockClient,
        undefined,
        expect.objectContaining({ user: "flag-user" })
      );
    });

    it("should merge root and local options for the handler", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      await runCli(asyncAction(fn), [
        "thing",
        "show",
        "42",
        "--json",
        "--yes",
        "-u",
        "u",
        "-p",
        "p",
      ]);

      expect(fn).toHaveBeenCalledWith(
        expect.anything(),
        "42",
        expect.objectContaining({ json: true, yes: true })
      );
    });

    it("should pass through additional arguments before options", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      await runCli(asyncAction<[string]>(fn), [
        "-u",
        "u",
        "-p",
        "p",
        "thing",
        "show",
        "arg1",
      ]);

      expect(fn).toHaveBeenCalledWith(
        expect.any(Object),
        "arg1",
        expect.any(Object)
      );
    });

    it("should handle Error from fn and call process.exit(1)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const action = asyncAction(
        vi.fn().mockRejectedValue(new Error("Action failed"))
      );
      await runCli(action, ["-u", "u", "-p", "p", "thing", "show"]);

      expect(consoleSpy).toHaveBeenCalledWith("ERROR: Action failed");
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle ExitPromptError and exit with 0", async () => {
      const exitErr = new Error("ExitPromptError");
      exitErr.name = "ExitPromptError";
      const action = asyncAction(vi.fn().mockRejectedValue(exitErr));
      await runCli(action, ["-u", "u", "-p", "p", "thing", "show"]);

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should handle unknown error type", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const action = asyncAction(vi.fn().mockRejectedValue("string error"));
      await runCli(action, ["-u", "u", "-p", "p", "thing", "show"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "ERROR: An unknown error occurred"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("output", () => {
    it("should output JSON when json option is true", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
      const formatter = vi.fn(() => "formatted");

      output({ id: 1 }, formatter, { json: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({ id: 1 }, null, 2)
      );
      expect(formatter).not.toHaveBeenCalled();
    });

    it("should use formatter when json option is false", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
      const formatter = vi.fn(() => "formatted output");

      output({ id: 1 }, formatter, { json: false });

      expect(formatter).toHaveBeenCalledWith({ id: 1 });
      expect(consoleSpy).toHaveBeenCalledWith("formatted output");
    });

    it("should use formatter when json option is undefined", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
      const formatter = vi.fn(() => "table");

      output("data", formatter, {});

      expect(formatter).toHaveBeenCalledWith("data");
      expect(consoleSpy).toHaveBeenCalledWith("table");
    });
  });

  describe("confirmAction", () => {
    it("should return true immediately when --yes is set", async () => {
      const result = await confirmAction("Delete?", { yes: true });

      expect(result).toBe(true);
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it("should prompt and return true when confirmed", async () => {
      mockConfirm.mockResolvedValue(true);

      const result = await confirmAction("Delete?", {});

      expect(mockConfirm).toHaveBeenCalledWith({
        message: "Delete?",
        default: false,
      });
      expect(result).toBe(true);
    });

    it("should prompt, log Aborted, and return false when not confirmed", async () => {
      mockConfirm.mockResolvedValue(false);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());

      const result = await confirmAction("Delete?", {});

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("Aborted.");
    });

    it("should pass custom default value to confirm", async () => {
      mockConfirm.mockResolvedValue(true);

      await confirmAction("Proceed?", {}, true);

      expect(mockConfirm).toHaveBeenCalledWith({
        message: "Proceed?",
        default: true,
      });
    });
  });
});
