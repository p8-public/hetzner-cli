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

vi.mock("./cache.js", () => ({
  fetchAuctionDataWithCache: vi.fn(),
}));

vi.mock("./store.js", () => ({
  getAuctionCache: vi.fn(),
  getLatestSnapshot: vi.fn(),
  getSnapshotServers: vi.fn(),
  openDatabase: vi.fn(() => ({ close: vi.fn() })),
  pruneSnapshots: vi.fn(),
  saveSnapshot: vi.fn(() => ({ id: 1, serverCount: 1 })),
}));

import { fetchAuctionDataWithCache } from "./cache.js";
import { registerAuctionCommands } from "./commands.js";
import { getLatestSnapshot } from "./store.js";

const SERVER = { id: 2_919_866, price: 42 };
const JSON_ARRAY_START = /^\[/;

/** Parse argv against a root that declares --json, like src/cli.ts does. */
async function run(argv: string[]): Promise<void> {
  const program = new Command().option("--json");
  registerAuctionCommands(program);
  await program.parseAsync(argv, { from: "user" });
}

describe("auction --json", () => {
  let stdout: MockInstance;
  let stderr: MockInstance;

  beforeEach(() => {
    stdout = vi.spyOn(console, "log").mockImplementation(vi.fn());
    stderr = vi.spyOn(console, "error").mockImplementation(vi.fn());
    vi.mocked(getLatestSnapshot).mockReturnValue(null);
    vi.mocked(fetchAuctionDataWithCache).mockResolvedValue({
      data: { server: [SERVER], serverCount: 1 },
      metadata: { source: "hosted-cache" },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should print JSON when the flag follows the subcommand", async () => {
    await run(["auction", "list", "--json"]);

    expect(JSON.parse(stdout.mock.calls[0][0] as string)).toEqual([SERVER]);
  });

  it("should print JSON when the flag precedes the subcommand", async () => {
    await run(["--json", "auction", "list"]);

    expect(JSON.parse(stdout.mock.calls[0][0] as string)).toEqual([SERVER]);
  });

  it("should print JSON for auction show", async () => {
    await run(["auction", "show", String(SERVER.id), "--json"]);

    expect(JSON.parse(stdout.mock.calls[0][0] as string)).toEqual(SERVER);
  });

  it("should print a table without the flag", async () => {
    vi.mocked(fetchAuctionDataWithCache).mockResolvedValueOnce({
      data: { server: [], serverCount: 0 },
      metadata: { source: "hosted-cache" },
    } as never);

    await run(["auction", "list"]);

    expect(stdout.mock.calls[0][0]).not.toMatch(JSON_ARRAY_START);
  });

  it("should keep the initial snapshot message off stdout", async () => {
    await run(["auction", "diff", "--json"]);

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("Initial snapshot saved")
    );
  });

  it("should print the initial snapshot message to stdout for humans", async () => {
    await run(["auction", "diff"]);

    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("Initial snapshot saved")
    );
    expect(stderr).not.toHaveBeenCalled();
  });
});
