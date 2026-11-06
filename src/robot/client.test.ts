import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HetznerRobotClient } from "./client.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("HetznerRobotClient", () => {
  let client: HetznerRobotClient;

  beforeEach(() => {
    client = new HetznerRobotClient("testuser", "testpass");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with credentials", () => {
      const c = new HetznerRobotClient("user", "pass");
      expect(c).toBeInstanceOf(HetznerRobotClient);
    });

    it("should encode credentials as base64", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([])),
      });

      await client.listServers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from("testuser:testpass").toString("base64")}`,
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            error: { code: "AUTH_ERROR", message: "Invalid credentials" },
          }),
      });

      await expect(client.listServers()).rejects.toThrow(
        "AUTH_ERROR: Invalid credentials"
      );
    });

    it("should handle non-JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Not JSON")),
      });

      await expect(client.listServers()).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
    });

    it("should handle 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      // deleteRdns returns void, so we just check it doesn't throw
      await expect(client.deleteRdns("1.2.3.4")).resolves.not.toThrow();
    });

    it("should handle 200 with empty body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      // Hetzner Robot API returns 200 with empty body for some DELETE operations
      await expect(client.deleteSshKey("ab:cd:ef")).resolves.not.toThrow();
    });
  });

  describe("Server Management", () => {
    it("should list servers", async () => {
      const mockServers = [
        { server: { server_ip: "1.2.3.4", server_number: 123 } },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockServers)),
      });

      const result = await client.listServers();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server",
        expect.any(Object)
      );
      expect(result).toEqual(mockServers);
    });

    it("should get server details", async () => {
      const mockServer = {
        server: { server_ip: "1.2.3.4", server_number: 123 },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockServer)),
      });

      const result = await client.getServer("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server/1.2.3.4",
        expect.any(Object)
      );
      expect(result).toEqual(mockServer);
    });

    it("should get server by number", async () => {
      const mockServer = {
        server: { server_ip: "1.2.3.4", server_number: 123 },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockServer)),
      });

      await client.getServer(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server/123",
        expect.any(Object)
      );
    });

    it("should update server name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ server: { server_name: "new-name" } })
          ),
      });

      await client.updateServerName(123, "new-name");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server/123",
        expect.objectContaining({
          method: "POST",
          body: "server_name=new-name",
        })
      );
    });
  });

  describe("Cancellation", () => {
    it("should get cancellation status", async () => {
      const mockCancellation = { cancellation: { cancelled: false } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockCancellation)),
      });

      const result = await client.getCancellation(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server/123/cancellation",
        expect.any(Object)
      );
      expect(result).toEqual(mockCancellation);
    });

    it("should cancel server with date and reasons", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ cancellation: { cancelled: true } })
          ),
      });

      await client.cancelServer(123, "2024-12-31", ["price", "service"]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/cancellation"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("cancellation_date=2024-12-31"),
        })
      );
    });

    it("should revoke cancellation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.revokeCancellation(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/server/123/cancellation",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Reset", () => {
    it("should list reset options", async () => {
      const mockResets = [
        { reset: { server_number: 123, type: ["sw", "hw"] } },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResets)),
      });

      const result = await client.listResetOptions();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/reset",
        expect.any(Object)
      );
      expect(result).toEqual(mockResets);
    });

    it("should get reset options for server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ reset: { type: ["sw", "hw"] } })),
      });

      await client.getResetOptions(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/reset/123",
        expect.any(Object)
      );
    });

    it("should reset server with default type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ reset: { server_number: 123 } })),
      });

      await client.resetServer(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/reset/123",
        expect.objectContaining({
          method: "POST",
          body: "type=sw",
        })
      );
    });

    it("should reset server with specified type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ reset: { server_number: 123 } })),
      });

      await client.resetServer(123, "hw");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: "type=hw",
        })
      );
    });
  });

  describe("Boot Configuration", () => {
    it("should get boot config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ boot: { rescue: null, linux: null } })
          ),
      });

      await client.getBootConfig(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123",
        expect.any(Object)
      );
    });

    it("should activate rescue", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ rescue: { active: true, password: "abc123" } })
          ),
      });

      await client.activateRescue(123, "linux", 64, ["fingerprint1"]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/rescue",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("os=linux"),
        })
      );
    });

    it("should deactivate rescue", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ rescue: { active: false } })),
      });

      await client.deactivateRescue(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/rescue",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should get last rescue", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ rescue: { password: "old-pass" } })),
      });

      await client.getLastRescue(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/rescue/last",
        expect.any(Object)
      );
    });

    it("should activate linux", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ linux: { active: true } })),
      });

      await client.activateLinux(123, "Debian-12", 64, "en", ["key1"]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/linux",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("dist=Debian-12"),
        })
      );
    });

    it("should deactivate linux", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ linux: { active: false } })),
      });

      await client.deactivateLinux(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/linux",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should activate vnc", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ vnc: { active: true } })),
      });

      await client.activateVnc(123, "Debian-12", 64, "en");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/vnc",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should activate windows", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ windows: { active: true } })),
      });

      await client.activateWindows(123, "standard", "en");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/windows",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("IP Management", () => {
    it("should list IPs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ ip: { ip: "1.2.3.4" } }])),
      });

      await client.listIps();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip",
        expect.any(Object)
      );
    });

    it("should get IP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ip: { ip: "1.2.3.4" } })),
      });

      await client.getIp("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip/1.2.3.4",
        expect.any(Object)
      );
    });

    it("should update IP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ ip: { traffic_warnings: true } })),
      });

      await client.updateIp("1.2.3.4", true, 100, 1000, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip/1.2.3.4",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("traffic_warnings=true"),
        })
      );
    });

    it("should generate IP MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ mac: { mac: "aa:bb:cc:dd:ee:ff" } })
          ),
      });

      await client.generateIpMac("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip/1.2.3.4/mac",
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("should delete IP MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteIpMac("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip/1.2.3.4/mac",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Subnet Management", () => {
    it("should list subnets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ subnet: { ip: "10.0.0.0" } }])),
      });

      await client.listSubnets();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet",
        expect.any(Object)
      );
    });

    it("should get subnet", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ subnet: { ip: "10.0.0.0" } })),
      });

      await client.getSubnet("10.0.0.0");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet/10.0.0.0",
        expect.any(Object)
      );
    });

    it("should update subnet", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ subnet: {} })),
      });

      await client.updateSubnet("10.0.0.0", true, 100, 1000, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet/10.0.0.0",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should generate subnet MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ mac: { mac: "aa:bb:cc:dd:ee:ff" } })
          ),
      });

      await client.generateSubnetMac("10.0.0.0");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet/10.0.0.0/mac",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("Failover", () => {
    it("should list failovers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ failover: { ip: "1.2.3.4" } }])),
      });

      await client.listFailovers();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/failover",
        expect.any(Object)
      );
    });

    it("should switch failover", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ failover: { active_server_ip: "5.6.7.8" } })
          ),
      });

      await client.switchFailover("1.2.3.4", "5.6.7.8");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/failover/1.2.3.4",
        expect.objectContaining({
          method: "POST",
          body: "active_server_ip=5.6.7.8",
        })
      );
    });

    it("should delete failover routing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteFailoverRouting("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/failover/1.2.3.4",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Reverse DNS", () => {
    it("should list RDNS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([
              { rdns: { ip: "1.2.3.4", ptr: "host.example.com" } },
            ])
          ),
      });

      await client.listRdns();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/rdns",
        expect.any(Object)
      );
    });

    it("should create RDNS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ rdns: { ptr: "host.example.com" } })
          ),
      });

      await client.createRdns("1.2.3.4", "host.example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/rdns/1.2.3.4",
        expect.objectContaining({
          method: "PUT",
          body: "ptr=host.example.com",
        })
      );
    });

    it("should update RDNS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ rdns: { ptr: "new.example.com" } })),
      });

      await client.updateRdns("1.2.3.4", "new.example.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/rdns/1.2.3.4",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("SSH Keys", () => {
    it("should list SSH keys", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([{ key: { fingerprint: "ab:cd:ef" } }])
          ),
      });

      await client.listSshKeys();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/key",
        expect.any(Object)
      );
    });

    it("should create SSH key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ key: { fingerprint: "ab:cd:ef" } })),
      });

      await client.createSshKey("my-key", "ssh-rsa AAAA...");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/key",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("name=my-key"),
        })
      );
    });

    it("should update SSH key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ key: { name: "new-name" } })),
      });

      await client.updateSshKey("ab:cd:ef", "new-name");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/key/ab:cd:ef",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete SSH key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await client.deleteSshKey("ab:cd:ef");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/key/ab:cd:ef",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Firewall", () => {
    it("should get firewall", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall: { status: "active" } })),
      });

      await client.getFirewall(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/123",
        expect.any(Object)
      );
    });

    it("should update firewall", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall: { status: "active" } })),
      });

      await client.updateFirewall(123, "active");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/123",
        expect.objectContaining({
          method: "POST",
          body: "status=active",
        })
      );
    });

    it("should delete firewall", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteFirewall(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/123",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should list firewall templates", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ firewall_template: { id: 1 } }])),
      });

      await client.listFirewallTemplates();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template",
        expect.any(Object)
      );
    });

    it("should create firewall template", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 1 } })),
      });

      await client.createFirewallTemplate("my-template", true, false, true);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete firewall template", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteFirewallTemplate(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("vSwitch", () => {
    it("should list vSwitches", async () => {
      const mockVSwitches = [
        { id: 1234, name: "vswitch 1234", vlan: 4000, cancelled: false },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockVSwitches)),
      });

      const result = await client.listVSwitches();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch",
        expect.any(Object)
      );
      expect(result).toEqual(mockVSwitches);
    });

    it("should create vSwitch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 1 })),
      });

      const result = await client.createVSwitch("my-vswitch", 4000);

      expect(result.id).toBe(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch",
        expect.objectContaining({
          method: "POST",
          body: "name=my-vswitch&vlan=4000",
        })
      );
    });

    it("should update vSwitch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await client.updateVSwitch(1, "new-name", 4001);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete vSwitch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteVSwitch(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should add server to vSwitch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await client.addServerToVSwitch(1, 123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1/server",
        expect.objectContaining({
          method: "POST",
          body: "server=123",
        })
      );
    });

    it("should remove server from vSwitch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.removeServerFromVSwitch(1, 123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1/server",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Storage Box", () => {
    it("should list storage boxes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ storagebox: { id: 1 } }])),
      });

      await client.listStorageBoxes();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox",
        expect.any(Object)
      );
    });

    it("should update storage box", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ storagebox: { id: 1 } })),
      });

      await client.updateStorageBox(1, "my-box", true, true, true, true, false);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should reset storage box password", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ password: "new-password" })),
      });

      const result = await client.resetStorageBoxPassword(1);

      expect(result.password).toBe("new-password");
    });

    it("should list snapshots", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ snapshot: { name: "snap1" } }])),
      });

      await client.listStorageBoxSnapshots(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshot",
        expect.any(Object)
      );
    });

    it("should create snapshot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ snapshot: { name: "snap1" } })),
      });

      await client.createStorageBoxSnapshot(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshot",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete snapshot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteStorageBoxSnapshot(1, "snap1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshot/snap1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should revert snapshot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.revertStorageBoxSnapshot(1, "snap1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshot/snap1/revert",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should manage subaccounts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ subaccount: { username: "sub1" } })),
      });

      await client.createStorageBoxSubaccount(
        1,
        "/home/user",
        true,
        true,
        true,
        true,
        false,
        "comment"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/subaccount",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Traffic", () => {
    it("should get traffic", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ traffic: { data: [] } })),
      });

      await client.getTraffic(
        ["1.2.3.4"],
        ["10.0.0.0"],
        "2024-01-01",
        "2024-01-31",
        "month"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/traffic",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("type=month"),
        })
      );
    });
  });

  describe("Wake on LAN", () => {
    it("should get WoL status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ wol: { server_number: 123 } })),
      });

      await client.getWol(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/wol/123",
        expect.any(Object)
      );
    });

    it("should send WoL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ wol: { server_number: 123 } })),
      });

      await client.sendWol(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/wol/123",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Ordering", () => {
    it("should list server products", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ product: { id: "AX41" } }])),
      });

      await client.listServerProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server/product",
        expect.any(Object)
      );
    });

    it("should list market products", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([{ product: { id: 1 } }])),
      });

      await client.listServerMarketProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server_market/product",
        expect.any(Object)
      );
    });

    it("should list transactions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify([{ transaction: { id: "TX-1" } }])),
      });

      await client.listServerTransactions();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server/transaction",
        expect.any(Object)
      );
    });

    it("should order server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ transaction: { id: "TX-1" } })),
      });

      await client.orderServer(
        "AX41",
        ["key1"],
        "pass",
        "Debian",
        64,
        "en",
        "FSN1",
        ["addon1"],
        true
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server/transaction",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should order server market product", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ transaction: { id: "TX-1" } })),
      });

      await client.orderServerMarket(
        12_345,
        ["key1"],
        "pass",
        "Debian",
        64,
        "en",
        ["addon1"],
        true
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server_market/transaction",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Storage Box Snapshot Plan", () => {
    it("should get snapshot plan", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ snapshotplan: { status: "enabled" } })
          ),
      });

      await client.getStorageBoxSnapshotPlan(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshotplan",
        expect.any(Object)
      );
    });

    it("should update snapshot plan", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ snapshotplan: { status: "enabled" } })
          ),
      });

      await client.updateStorageBoxSnapshotPlan(1, "enabled", 0, 3, 1, 15, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/snapshotplan",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Storage Box Subaccounts", () => {
    it("should list subaccounts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([{ subaccount: { username: "sub1" } }])
          ),
      });

      await client.listStorageBoxSubaccounts(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/subaccount",
        expect.any(Object)
      );
    });

    it("should update subaccount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ subaccount: { username: "sub1" } })),
      });

      await client.updateStorageBoxSubaccount(
        1,
        "sub1",
        true,
        true,
        true,
        true,
        false,
        "updated"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/subaccount/sub1",
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("should delete subaccount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteStorageBoxSubaccount(1, "sub1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/subaccount/sub1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should reset subaccount password", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ password: "new-pass" })),
      });

      const result = await client.resetStorageBoxSubaccountPassword(1, "sub1");

      expect(result.password).toBe("new-pass");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/1/subaccount/sub1/password",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Additional Boot Methods", () => {
    it("should get rescue config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ rescue: { active: false } })),
      });

      await client.getRescue(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/rescue",
        expect.any(Object)
      );
    });

    it("should get linux config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ linux: { active: false } })),
      });

      await client.getLinux(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/linux",
        expect.any(Object)
      );
    });

    it("should get last linux config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ linux: { password: "old-pass" } })),
      });

      await client.getLastLinux(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/linux/last",
        expect.any(Object)
      );
    });

    it("should get vnc config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ vnc: { active: false } })),
      });

      await client.getVnc(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/vnc",
        expect.any(Object)
      );
    });

    it("should deactivate vnc", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ vnc: { active: false } })),
      });

      await client.deactivateVnc(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/vnc",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should get windows config", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ windows: { active: false } })),
      });

      await client.getWindows(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/windows",
        expect.any(Object)
      );
    });

    it("should deactivate windows", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ windows: { active: false } })),
      });

      await client.deactivateWindows(123);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/boot/123/windows",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Additional Firewall Methods", () => {
    it("should update firewall template", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 1 } })),
      });

      await client.updateFirewallTemplate(1, "new-name", true, false, false);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template/1",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("IP Cancellation", () => {
    it("should get IP MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ mac: { ip: "1.2.3.4", mac: "aa:bb:cc:dd:ee:ff" } })
          ),
      });

      await client.getIpMac("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/ip/1.2.3.4/mac",
        expect.any(Object)
      );
    });

    it("should get subnet MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ mac: { mac: "aa:bb:cc:dd:ee:ff" } })
          ),
      });

      await client.getSubnetMac("10.0.0.0");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet/10.0.0.0/mac",
        expect.any(Object)
      );
    });

    it("should delete subnet MAC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteSubnetMac("10.0.0.0");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/subnet/10.0.0.0/mac",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("encodeParams edge cases", () => {
    it("should handle undefined values by skipping them", async () => {
      // updateVSwitch with only name (vlan undefined) triggers encodeParams with undefined
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await client.updateVSwitch(1, "test-name");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1",
        expect.objectContaining({
          method: "POST",
          body: "name=test-name",
        })
      );
    });

    it("should handle boolean values by converting to string", async () => {
      // createFirewallTemplate passes boolean params (filter_ipv6, whitelist_hos, is_default)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 2 } })),
      });

      await client.createFirewallTemplate("bool-test", false, true, false);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("filter_ipv6=false");
      expect(body).toContain("whitelist_hos=true");
      expect(body).toContain("is_default=false");
    });

    it("should handle array values by encoding each with [] suffix", async () => {
      // getTraffic with multiple IPs triggers the array branch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ traffic: { data: [] } })),
      });

      await client.getTraffic(
        ["1.2.3.4", "5.6.7.8"],
        [],
        "2024-01-01",
        "2024-01-31",
        "month"
      );

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("ip[]=1.2.3.4");
      expect(body).toContain("ip[]=5.6.7.8");
    });
  });

  describe("error handling edge cases", () => {
    it("should handle error response with missing code", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: { message: "Access denied" } }),
      });

      await expect(client.listServers()).rejects.toThrow(
        "ERROR: Access denied"
      );
    });

    it("should handle error response with no error object", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ some_other_field: "value" }),
      });

      await expect(client.listServers()).rejects.toThrow(
        "HTTP 400: Bad Request"
      );
    });

    it("should handle error response with missing message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: { code: "FORBIDDEN" } }),
      });

      await expect(client.listServers()).rejects.toThrow(
        "FORBIDDEN: Unknown error"
      );
    });
  });

  describe("SSH Keys - getSshKey", () => {
    it("should get SSH key by fingerprint", async () => {
      const mockKey = {
        key: {
          fingerprint: "ab:cd:ef:12:34",
          name: "my-key",
          type: "RSA",
          size: 4096,
          data: "ssh-rsa AAAA...",
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockKey)),
      });

      const result = await client.getSshKey("ab:cd:ef:12:34");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/key/ab:cd:ef:12:34",
        expect.any(Object)
      );
      expect(result).toEqual(mockKey);
    });
  });

  describe("Firewall Templates - additional coverage", () => {
    it("should get firewall template by ID", async () => {
      const mockTemplate = {
        firewall_template: { id: 5, name: "test-template" },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockTemplate)),
      });

      const result = await client.getFirewallTemplate(5);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template/5",
        expect.any(Object)
      );
      expect(result).toEqual(mockTemplate);
    });

    it("should create firewall template with rules", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 2 } })),
      });

      const rules = {
        input: [
          {
            ip_version: "ipv4",
            name: "Allow SSH",
            dst_ip: null,
            dst_port: "22",
            src_ip: null,
            src_port: null,
            action: "accept" as const,
            protocol: "tcp",
            tcp_flags: null,
          },
        ],
      };
      await client.createFirewallTemplate(
        "with-rules",
        true,
        false,
        true,
        rules
      );

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("name=with-rules");
      expect(body).toContain("rules%5Binput%5D=");
      expect(body).toContain(encodeURIComponent(JSON.stringify(rules.input)));
    });

    it("should update firewall template with rules", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 1 } })),
      });

      const rules = {
        input: [
          {
            ip_version: "ipv4",
            name: "Allow HTTP",
            dst_ip: null,
            dst_port: "80",
            src_ip: null,
            src_port: null,
            action: "accept" as const,
            protocol: "tcp",
            tcp_flags: null,
          },
        ],
      };
      await client.updateFirewallTemplate(
        1,
        "updated-name",
        true,
        false,
        false,
        rules
      );

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("name=updated-name");
      expect(body).toContain("rules%5Binput%5D=");
      expect(body).toContain(encodeURIComponent(JSON.stringify(rules.input)));
      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/firewall/template/1",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update firewall with rules", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall: { status: "active" } })),
      });

      const rules = {
        input: [
          {
            ip_version: "ipv4",
            name: "Allow HTTPS",
            dst_ip: null,
            dst_port: "443",
            src_ip: null,
            src_port: null,
            action: "accept" as const,
            protocol: "tcp",
            tcp_flags: null,
          },
        ],
      };
      await client.updateFirewall(123, "active", rules);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("status=active");
      expect(body).toContain("rules%5Binput%5D=");
      expect(body).toContain(encodeURIComponent(JSON.stringify(rules.input)));
    });
  });

  describe("vSwitch - additional coverage", () => {
    it("should get vSwitch by ID", async () => {
      const mockVSwitch = {
        id: 42,
        name: "my-vswitch",
        vlan: 4000,
        cancelled: false,
        server: [],
        subnet: [],
        cloud_network: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockVSwitch)),
      });

      const result = await client.getVSwitch(42);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/42",
        expect.any(Object)
      );
      expect(result).toEqual(mockVSwitch);
    });

    it("should delete vSwitch with cancellation date", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteVSwitch(1, "2025-12-31");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toContain("cancellation_date=2025-12-31");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/vswitch/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Storage Box - additional coverage", () => {
    it("should get storage box by ID", async () => {
      const mockBox = {
        storagebox: {
          id: 10,
          name: "my-box",
          login: "u12345",
          product: "BX11",
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockBox)),
      });

      const result = await client.getStorageBox(10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/storagebox/10",
        expect.any(Object)
      );
      expect(result).toEqual(mockBox);
    });
  });

  describe("Server Transactions - additional coverage", () => {
    it("should get server transaction by ID", async () => {
      const mockTransaction = {
        transaction: { id: "TX-123", product_id: "AX41", status: "ready" },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockTransaction)),
      });

      const result = await client.getServerTransaction("TX-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/order/server/transaction/TX-123",
        expect.any(Object)
      );
      expect(result).toEqual(mockTransaction);
    });
  });

  describe("Optional parameter branches", () => {
    it("should get traffic with empty IPs and subnets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ traffic: { data: [] } })),
      });

      await client.getTraffic([], [], "2024-01-01", "2024-01-31", "month");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).not.toContain("ip");
      expect(body).not.toContain("subnet");
      expect(body).toContain("type=month");
    });

    it("should order server without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ transaction: { id: "TX-2" } })),
      });

      await client.orderServer("AX41");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("product_id=AX41");
    });

    it("should order server market without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ transaction: { id: "TX-3" } })),
      });

      await client.orderServerMarket(12_345);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("product_id=12345");
    });

    it("should update storage box with no optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ storagebox: { id: 1 } })),
      });

      await client.updateStorageBox(1);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should create storage box subaccount with minimal params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ subaccount: { username: "sub1" } })),
      });

      await client.createStorageBoxSubaccount(1, "/home/user");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("homedirectory=%2Fhome%2Fuser");
    });

    it("should update storage box subaccount with no optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ subaccount: { username: "sub1" } })),
      });

      await client.updateStorageBoxSubaccount(1, "sub1");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should update snapshot plan with only status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ snapshotplan: { status: "disabled" } })
          ),
      });

      await client.updateStorageBoxSnapshotPlan(1, "disabled");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("status=disabled");
    });

    it("should cancel server without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ cancellation: { cancelled: true } })
          ),
      });

      await client.cancelServer(123);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should activate rescue without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ rescue: { active: true } })),
      });

      await client.activateRescue(123, "linux");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("os=linux");
    });

    it("should activate linux without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ linux: { active: true } })),
      });

      await client.activateLinux(123, "Debian-12");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("dist=Debian-12");
    });

    it("should activate vnc without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ vnc: { active: true } })),
      });

      await client.activateVnc(123, "Debian-12");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("dist=Debian-12");
    });

    it("should activate windows without optional lang", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ windows: { active: true } })),
      });

      await client.activateWindows(123, "standard");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("dist=standard");
    });

    it("should update firewall without rules", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall: { status: "disabled" } })),
      });

      await client.updateFirewall(123, "disabled");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("status=disabled");
    });

    it("should create firewall template without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 3 } })),
      });

      await client.createFirewallTemplate("minimal-template");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("name=minimal-template");
    });

    it("should update firewall template without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ firewall_template: { id: 1 } })),
      });

      await client.updateFirewallTemplate(1);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should update vSwitch without optional params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await client.updateVSwitch(1);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should delete vSwitch without cancellation date", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteVSwitch(2);

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should update IP without optional traffic params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ip: { ip: "1.2.3.4" } })),
      });

      await client.updateIp("1.2.3.4");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });

    it("should update subnet without optional traffic params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ subnet: {} })),
      });

      await client.updateSubnet("10.0.0.0");

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = call[1].body as string;
      expect(body).toBe("");
    });
  });

  describe("Failover Additional Methods", () => {
    it("should get failover", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ failover: { ip: "1.2.3.4" } })),
      });

      await client.getFailover("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/failover/1.2.3.4",
        expect.any(Object)
      );
    });
  });

  describe("RDNS Additional Methods", () => {
    it("should get RDNS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ rdns: { ip: "1.2.3.4", ptr: "host.com" } })
          ),
      });

      await client.getRdns("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/rdns/1.2.3.4",
        expect.any(Object)
      );
    });

    it("should delete RDNS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      await client.deleteRdns("1.2.3.4");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://robot-ws.your-server.de/rdns/1.2.3.4",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
