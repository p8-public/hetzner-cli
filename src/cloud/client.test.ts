import { beforeEach, describe, expect, it, vi } from "vitest";
import { HetznerCloudClient } from "./client.js";

const ISO_PARAMS_REGEX =
  /name=FreeBSD.*architecture=x86|architecture=x86.*name=FreeBSD/;
const SERVER_METRICS_REGEX = /servers\/1\/metrics\?.*type=cpu/;

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(data),
  };
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
    statusText: "No Content",
    json: () => Promise.reject(new Error("No content")),
  };
}

function errorResponse(status: number, text: string, body?: unknown) {
  return {
    ok: false,
    status,
    statusText: text,
    json: body
      ? () => Promise.resolve(body)
      : () => Promise.reject(new Error("Not JSON")),
  };
}

function paginatedResponse(
  key: string,
  items: unknown[],
  nextPage: number | null
) {
  return jsonResponse({
    [key]: items,
    meta: {
      pagination: {
        page: nextPage ? nextPage - 1 : 1,
        per_page: 50,
        previous_page: null,
        next_page: nextPage,
        last_page: nextPage ?? 1,
        total_entries: items.length,
      },
    },
  });
}

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "success",
    command: "test",
    progress: 100,
    started: "",
    finished: "",
    resources: [],
    error: null,
    ...overrides,
  };
}

describe("HetznerCloudClient", () => {
  let client: HetznerCloudClient;

  beforeEach(() => {
    client = new HetznerCloudClient("test-token");
    mockFetch.mockReset();
  });

  describe("constructor and request", () => {
    it("should create a client instance", () => {
      expect(client).toBeInstanceOf(HetznerCloudClient);
    });

    it("should send Bearer auth header", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("datacenters", [], null)
      );

      await client.listDatacenters();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        })
      );
    });

    it("should throw structured error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(403, "Forbidden", {
          error: { code: "forbidden", message: "Insufficient permissions" },
        })
      );

      await expect(client.listDatacenters()).rejects.toThrow(
        "forbidden: Insufficient permissions"
      );
    });

    it("should throw fallback error when error body is not JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(500, "Internal Server Error")
      );

      await expect(client.listDatacenters()).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
    });

    it("should handle error body with missing code/message", async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(400, "Bad Request", {
          error: {},
        })
      );

      await expect(client.listDatacenters()).rejects.toThrow(
        "ERROR: Unknown error"
      );
    });

    it("should throw default HTTP error when error body has no error field", async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(422, "Unprocessable Entity", {
          message: "oops",
        })
      );

      await expect(client.listDatacenters()).rejects.toThrow(
        "HTTP 422: Unprocessable Entity"
      );
    });

    it("should return empty object for 204 response", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteNetwork(1)).resolves.not.toThrow();
    });

    it("should parse JSON body for non-204 success response", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ datacenter: { id: 1, name: "fsn1-dc14" } })
      );

      const result = await client.getDatacenter(1);
      expect(result.name).toBe("fsn1-dc14");
    });
  });

  describe("listAll pagination", () => {
    it("should return items from a single page", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("datacenters", [{ id: 1 }, { id: 2 }], null)
      );

      const result = await client.listDatacenters();
      expect(result).toHaveLength(2);
    });

    it("should fetch multiple pages", async () => {
      mockFetch
        .mockResolvedValueOnce(paginatedResponse("datacenters", [{ id: 1 }], 2))
        .mockResolvedValueOnce(
          paginatedResponse("datacenters", [{ id: 2 }], null)
        );

      const result = await client.listDatacenters();
      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when no items", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("datacenters", [], null)
      );

      const result = await client.listDatacenters();
      expect(result).toHaveLength(0);
    });

    it("should stop when no meta pagination", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          datacenters: [{ id: 1 }],
        })
      );

      const result = await client.listDatacenters();
      expect(result).toHaveLength(1);
    });
  });

  describe("waitForAction", () => {
    it("should return action on success", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: makeAction() }));

      const result = await client.waitForAction(1);
      expect(result.status).toBe("success");
    });

    it("should throw on error status", async () => {
      const action = makeAction({
        status: "error",
        progress: 0,
        error: { code: "ERR", message: "Failed" },
      });
      mockFetch.mockResolvedValueOnce(jsonResponse({ action }));

      await expect(client.waitForAction(1)).rejects.toThrow(
        "Action 1 failed: Failed"
      );
    });

    it("should throw on error with null error details", async () => {
      const action = makeAction({ status: "error", progress: 0 });
      mockFetch.mockResolvedValueOnce(jsonResponse({ action }));

      await expect(client.waitForAction(1)).rejects.toThrow(
        "Action 1 failed: Unknown error"
      );
    });

    it("should poll until success", async () => {
      const running = makeAction({
        status: "running",
        progress: 50,
        finished: null,
      });
      const success = makeAction();

      mockFetch
        .mockResolvedValueOnce(jsonResponse({ action: running }))
        .mockResolvedValueOnce(jsonResponse({ action: success }));

      vi.useFakeTimers();
      const promise = client.waitForAction(1);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.status).toBe("success");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("should timeout after specified duration", async () => {
      const running = makeAction({
        status: "running",
        progress: 50,
        finished: null,
      });
      mockFetch.mockResolvedValue(jsonResponse({ action: running }));

      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = () => {
        callCount++;
        return callCount <= 1 ? 0 : 5000;
      };

      await expect(client.waitForAction(1, 2000)).rejects.toThrow(
        "Action 1 timed out after 2000ms"
      );
      Date.now = originalDateNow;
    });
  });

  describe("Datacenters", () => {
    it("should list datacenters", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("datacenters", [{ id: 1, name: "fsn1-dc14" }], null)
      );

      const result = await client.listDatacenters();
      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/datacenters"),
        expect.any(Object)
      );
    });

    it("should get datacenter by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ datacenter: { id: 1, name: "fsn1-dc14" } })
      );

      const result = await client.getDatacenter(1);
      expect(result.name).toBe("fsn1-dc14");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/datacenters/1"),
        expect.any(Object)
      );
    });
  });

  describe("Locations", () => {
    it("should list locations", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("locations", [{ id: 1, name: "fsn1" }], null)
      );

      const result = await client.listLocations();
      expect(result).toHaveLength(1);
    });

    it("should get location by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ location: { id: 1, name: "fsn1" } })
      );

      const result = await client.getLocation(1);
      expect(result.name).toBe("fsn1");
    });
  });

  describe("Server Types", () => {
    it("should list server types", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("server_types", [{ id: 1, name: "cx11" }], null)
      );

      const result = await client.listServerTypes();
      expect(result).toHaveLength(1);
    });

    it("should get server type by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ server_type: { id: 1, name: "cx11" } })
      );

      const result = await client.getServerType(1);
      expect(result.name).toBe("cx11");
    });
  });

  describe("Load Balancer Types", () => {
    it("should list load balancer types", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse(
          "load_balancer_types",
          [{ id: 1, name: "lb11" }],
          null
        )
      );

      const result = await client.listLoadBalancerTypes();
      expect(result).toHaveLength(1);
    });

    it("should get load balancer type by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ load_balancer_type: { id: 1, name: "lb11" } })
      );

      const result = await client.getLoadBalancerType(1);
      expect(result.name).toBe("lb11");
    });
  });

  describe("ISOs", () => {
    it("should list isos", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("isos", [{ id: 1, name: "FreeBSD.iso" }], null)
      );

      const result = await client.listIsos();
      expect(result).toHaveLength(1);
    });

    it("should list isos with filters", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("isos", [{ id: 1 }], null)
      );

      await client.listIsos({ name: "FreeBSD", architecture: "x86" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(ISO_PARAMS_REGEX),
        expect.any(Object)
      );
    });

    it("should get iso by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ iso: { id: 1, name: "FreeBSD.iso" } })
      );

      const result = await client.getIso(1);
      expect(result.name).toBe("FreeBSD.iso");
    });
  });

  describe("Servers", () => {
    it("should list servers", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("servers", [{ id: 1, name: "srv1" }], null)
      );

      const result = await client.listServers();
      expect(result).toHaveLength(1);
    });

    it("should list servers with filters", async () => {
      mockFetch.mockResolvedValueOnce(paginatedResponse("servers", [], null));

      await client.listServers({
        label_selector: "env=prod",
        status: "running",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("label_selector=env%3Dprod"),
        expect.any(Object)
      );
    });

    it("should get server by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ server: { id: 1, name: "srv1" } })
      );

      const result = await client.getServer(1);
      expect(result.name).toBe("srv1");
    });

    it("should create server", async () => {
      const response = {
        server: { id: 1 },
        action: { id: 1 },
        root_password: "abc123",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(response));

      const result = await client.createServer({
        name: "srv1",
        server_type: "cx11",
        image: "ubuntu-22.04",
      });

      expect(result.root_password).toBe("abc123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"name":"srv1"'),
        })
      );
    });

    it("should delete server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      const result = await client.deleteServer(1);
      expect(result.action.id).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should update server", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ server: { id: 1, name: "new-name" } })
      );

      const result = await client.updateServer(1, { name: "new-name" });
      expect(result.server.name).toBe("new-name");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1"),
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("should power on server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.powerOnServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/poweron"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should power off server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.powerOffServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/poweroff"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should reboot server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.rebootServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/reboot"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should reset server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.resetServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/reset"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should shutdown server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.shutdownServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/shutdown"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should rebuild server", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ action: { id: 1 }, root_password: "newpass" })
      );

      const result = await client.rebuildServer(1, "ubuntu-22.04");
      expect(result.root_password).toBe("newpass");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/rebuild"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ image: "ubuntu-22.04" }),
        })
      );
    });

    it("should change server type", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeServerType(1, "cx21", true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/change_type"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ server_type: "cx21", upgrade_disk: true }),
        })
      );
    });

    it("should enable server rescue", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ action: { id: 1 }, root_password: "rescue-pass" })
      );

      const result = await client.enableServerRescue(1, "linux64", [1, 2]);
      expect(result.root_password).toBe("rescue-pass");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/enable_rescue"),
        expect.objectContaining({
          body: JSON.stringify({ type: "linux64", ssh_keys: [1, 2] }),
        })
      );
    });

    it("should disable server rescue", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.disableServerRescue(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/disable_rescue"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should enable server backup", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.enableServerBackup(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/enable_backup"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should disable server backup", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.disableServerBackup(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/disable_backup"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should create server image", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ image: { id: 1 }, action: { id: 1 } })
      );

      const result = await client.createServerImage(1, {
        description: "test",
        type: "snapshot",
      });
      expect(result.image.id).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/create_image"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ description: "test", type: "snapshot" }),
        })
      );
    });

    it("should attach iso to server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.attachIsoToServer(1, "FreeBSD.iso");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/attach_iso"),
        expect.objectContaining({
          body: JSON.stringify({ iso: "FreeBSD.iso" }),
        })
      );
    });

    it("should detach iso from server", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.detachIsoFromServer(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/detach_iso"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should reset server password", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ action: { id: 1 }, root_password: "newpass" })
      );

      const result = await client.resetServerPassword(1);
      expect(result.root_password).toBe("newpass");
    });

    it("should set server rDNS", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.setServerRdns(1, "1.2.3.4", "server.example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/change_dns_ptr"),
        expect.objectContaining({
          body: JSON.stringify({
            ip: "1.2.3.4",
            dns_ptr: "server.example.com",
          }),
        })
      );
    });

    it("should enable server protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.enableServerProtection(1, { delete: true, rebuild: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true, rebuild: true }),
        })
      );
    });

    it("should request server console", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          wss_url: "wss://example.com/console",
          password: "console-pass",
          action: { id: 1 },
        })
      );

      const result = await client.requestServerConsole(1);
      expect(result.wss_url).toBe("wss://example.com/console");
      expect(result.password).toBe("console-pass");
    });

    it("should attach server to network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.attachServerToNetwork(1, 123, "10.0.0.5", ["10.0.0.6"]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/attach_to_network"),
        expect.objectContaining({
          body: JSON.stringify({
            network: 123,
            ip: "10.0.0.5",
            alias_ips: ["10.0.0.6"],
          }),
        })
      );
    });

    it("should detach server from network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.detachServerFromNetwork(1, 123);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/detach_from_network"),
        expect.objectContaining({
          body: JSON.stringify({ network: 123 }),
        })
      );
    });

    it("should add server to placement group", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.addServerToPlacementGroup(1, 5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/servers/1/actions/add_to_placement_group"),
        expect.objectContaining({
          body: JSON.stringify({ placement_group: 5 }),
        })
      );
    });

    it("should remove server from placement group", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.removeServerFromPlacementGroup(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/servers/1/actions/remove_from_placement_group"
        ),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should get server metrics", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ metrics: { timeseries: {} } })
      );

      const result = await client.getServerMetrics(
        1,
        "cpu",
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z"
      );
      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(SERVER_METRICS_REGEX),
        expect.any(Object)
      );
    });
  });

  describe("Networks", () => {
    it("should list networks", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("networks", [{ id: 1 }], null)
      );

      const result = await client.listNetworks();
      expect(result).toHaveLength(1);
    });

    it("should list networks with filters", async () => {
      mockFetch.mockResolvedValueOnce(paginatedResponse("networks", [], null));

      await client.listNetworks({ name: "mynet" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("name=mynet"),
        expect.any(Object)
      );
    });

    it("should get network by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ network: { id: 1, name: "mynet" } })
      );

      const result = await client.getNetwork(1);
      expect(result.name).toBe("mynet");
    });

    it("should create network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ network: { id: 1 } }));

      const result = await client.createNetwork({
        name: "mynet",
        ip_range: "10.0.0.0/8",
      });
      expect(result.network.id).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "mynet", ip_range: "10.0.0.0/8" }),
        })
      );
    });

    it("should delete network", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteNetwork(1)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should update network", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ network: { id: 1, name: "renamed" } })
      );

      const result = await client.updateNetwork(1, { name: "renamed" });
      expect(result.network.name).toBe("renamed");
    });

    it("should add subnet to network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.addSubnetToNetwork(1, {
        type: "cloud",
        ip_range: "10.0.1.0/24",
        network_zone: "eu-central",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/add_subnet"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete subnet from network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.deleteSubnetFromNetwork(1, "10.0.1.0/24");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/delete_subnet"),
        expect.objectContaining({
          body: JSON.stringify({ ip_range: "10.0.1.0/24" }),
        })
      );
    });

    it("should add route to network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.addRouteToNetwork(1, {
        destination: "10.100.1.0/24",
        gateway: "10.0.1.1",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/add_route"),
        expect.objectContaining({
          body: JSON.stringify({
            destination: "10.100.1.0/24",
            gateway: "10.0.1.1",
          }),
        })
      );
    });

    it("should delete route from network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.deleteRouteFromNetwork(1, {
        destination: "10.100.1.0/24",
        gateway: "10.0.1.1",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/delete_route"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should change network IP range", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeNetworkIpRange(1, "10.0.0.0/16");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/change_ip_range"),
        expect.objectContaining({
          body: JSON.stringify({ ip_range: "10.0.0.0/16" }),
        })
      );
    });

    it("should change network protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeNetworkProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/networks/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });
  });

  describe("Firewalls", () => {
    it("should list firewalls", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("firewalls", [{ id: 1 }], null)
      );

      const result = await client.listFirewalls();
      expect(result).toHaveLength(1);
    });

    it("should get firewall by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ firewall: { id: 1, name: "fw1" } })
      );

      const result = await client.getFirewall(1);
      expect(result.name).toBe("fw1");
    });

    it("should create firewall", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ firewall: { id: 1 }, actions: [] })
      );

      const result = await client.createFirewall({ name: "fw1" });
      expect(result.firewall.id).toBe(1);
    });

    it("should delete firewall", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteFirewall(1)).resolves.not.toThrow();
    });

    it("should update firewall", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ firewall: { id: 1, name: "renamed" } })
      );

      const result = await client.updateFirewall(1, { name: "renamed" });
      expect(result.firewall.name).toBe("renamed");
    });

    it("should set firewall rules", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ actions: [{ id: 1 }] }));

      const rules = [
        {
          direction: "in" as const,
          protocol: "tcp" as const,
          port: "80",
          source_ips: ["0.0.0.0/0"],
          destination_ips: [],
          description: null,
        },
      ];
      const result = await client.setFirewallRules(1, rules);
      expect(result.actions).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/firewalls/1/actions/set_rules"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should apply firewall to resources", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ actions: [{ id: 1 }] }));

      await client.applyFirewall(1, [{ type: "server", server: { id: 42 } }]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/firewalls/1/actions/apply_to_resources"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should remove firewall from resources", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ actions: [{ id: 1 }] }));

      await client.removeFirewallFromResources(1, [
        { type: "server", server: { id: 42 } },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/firewalls/1/actions/remove_from_resources"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Floating IPs", () => {
    it("should list floating IPs", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("floating_ips", [{ id: 1 }], null)
      );

      const result = await client.listFloatingIps();
      expect(result).toHaveLength(1);
    });

    it("should get floating IP by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ floating_ip: { id: 1, name: "ip1" } })
      );

      const result = await client.getFloatingIp(1);
      expect(result.name).toBe("ip1");
    });

    it("should create floating IP", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ floating_ip: { id: 1 }, action: { id: 1 } })
      );

      const result = await client.createFloatingIp({
        type: "ipv4",
        home_location: "fsn1",
      });
      expect(result.floating_ip.id).toBe(1);
    });

    it("should delete floating IP", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteFloatingIp(1)).resolves.not.toThrow();
    });

    it("should update floating IP", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ floating_ip: { id: 1, name: "renamed" } })
      );

      const result = await client.updateFloatingIp(1, { name: "renamed" });
      expect(result.floating_ip.name).toBe("renamed");
    });

    it("should assign floating IP", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.assignFloatingIp(1, 42);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/floating_ips/1/actions/assign"),
        expect.objectContaining({
          body: JSON.stringify({ server: 42 }),
        })
      );
    });

    it("should unassign floating IP", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.unassignFloatingIp(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/floating_ips/1/actions/unassign"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should change floating IP protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeFloatingIpProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/floating_ips/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });

    it("should change floating IP DNS ptr", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeFloatingIpDnsPtr(1, "1.2.3.4", "server.example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/floating_ips/1/actions/change_dns_ptr"),
        expect.objectContaining({
          body: JSON.stringify({
            ip: "1.2.3.4",
            dns_ptr: "server.example.com",
          }),
        })
      );
    });
  });

  describe("Primary IPs", () => {
    it("should list primary IPs", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("primary_ips", [{ id: 1 }], null)
      );

      const result = await client.listPrimaryIps();
      expect(result).toHaveLength(1);
    });

    it("should get primary IP by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ primary_ip: { id: 1, name: "pip1" } })
      );

      const result = await client.getPrimaryIp(1);
      expect(result.name).toBe("pip1");
    });

    it("should create primary IP", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ primary_ip: { id: 1 }, action: { id: 1 } })
      );

      const result = await client.createPrimaryIp({
        type: "ipv4",
        name: "pip1",
        assignee_type: "server",
        location: "fsn1",
      });
      expect(result.primary_ip.id).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/primary_ips"),
        expect.objectContaining({
          body: expect.stringContaining('"location":"fsn1"'),
        })
      );
    });

    it("should delete primary IP", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deletePrimaryIp(1)).resolves.not.toThrow();
    });

    it("should update primary IP", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ primary_ip: { id: 1, name: "renamed" } })
      );

      const result = await client.updatePrimaryIp(1, { name: "renamed" });
      expect(result.primary_ip.name).toBe("renamed");
    });

    it("should assign primary IP", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.assignPrimaryIp(1, 42);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/primary_ips/1/actions/assign"),
        expect.objectContaining({
          body: JSON.stringify({ assignee_id: 42, assignee_type: "server" }),
        })
      );
    });

    it("should unassign primary IP", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.unassignPrimaryIp(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/primary_ips/1/actions/unassign"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should change primary IP protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changePrimaryIpProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/primary_ips/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });

    it("should change primary IP DNS ptr", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changePrimaryIpDnsPtr(1, "1.2.3.4", "server.example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/primary_ips/1/actions/change_dns_ptr"),
        expect.objectContaining({
          body: JSON.stringify({
            ip: "1.2.3.4",
            dns_ptr: "server.example.com",
          }),
        })
      );
    });
  });

  describe("Volumes", () => {
    it("should list volumes", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("volumes", [{ id: 1 }], null)
      );

      const result = await client.listVolumes();
      expect(result).toHaveLength(1);
    });

    it("should get volume by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ volume: { id: 1, name: "vol1" } })
      );

      const result = await client.getVolume(1);
      expect(result.name).toBe("vol1");
    });

    it("should create volume", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ volume: { id: 1 }, action: { id: 1 }, next_actions: [] })
      );

      const result = await client.createVolume({ name: "vol1", size: 50 });
      expect(result.volume.id).toBe(1);
    });

    it("should delete volume", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteVolume(1)).resolves.not.toThrow();
    });

    it("should update volume", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ volume: { id: 1, name: "renamed" } })
      );

      const result = await client.updateVolume(1, { name: "renamed" });
      expect(result.volume.name).toBe("renamed");
    });

    it("should attach volume", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.attachVolume(1, 42, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/volumes/1/actions/attach"),
        expect.objectContaining({
          body: JSON.stringify({ server: 42, automount: true }),
        })
      );
    });

    it("should detach volume", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.detachVolume(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/volumes/1/actions/detach"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should resize volume", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.resizeVolume(1, 100);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/volumes/1/actions/resize"),
        expect.objectContaining({
          body: JSON.stringify({ size: 100 }),
        })
      );
    });

    it("should change volume protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeVolumeProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/volumes/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });
  });

  describe("Load Balancers", () => {
    it("should list load balancers", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("load_balancers", [{ id: 1 }], null)
      );

      const result = await client.listLoadBalancers();
      expect(result).toHaveLength(1);
    });

    it("should get load balancer by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ load_balancer: { id: 1, name: "lb1" } })
      );

      const result = await client.getLoadBalancer(1);
      expect(result.name).toBe("lb1");
    });

    it("should create load balancer", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ load_balancer: { id: 1 }, action: { id: 1 } })
      );

      const result = await client.createLoadBalancer({
        name: "lb1",
        load_balancer_type: "lb11",
      });
      expect(result.load_balancer.id).toBe(1);
    });

    it("should delete load balancer", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteLoadBalancer(1)).resolves.not.toThrow();
    });

    it("should update load balancer", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ load_balancer: { id: 1, name: "renamed" } })
      );

      const result = await client.updateLoadBalancer(1, { name: "renamed" });
      expect(result.load_balancer.name).toBe("renamed");
    });

    it("should add target to load balancer", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.addTargetToLoadBalancer(1, {
        type: "server",
        server: { id: 42 },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/add_target"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should remove target from load balancer", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.removeTargetFromLoadBalancer(1, {
        type: "server",
        server: { id: 42 },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/remove_target"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should add service to load balancer", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.addServiceToLoadBalancer(1, {
        protocol: "http",
        listen_port: 80,
        destination_port: 8080,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/add_service"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update service on load balancer", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.updateServiceOnLoadBalancer(1, {
        protocol: "http",
        listen_port: 80,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/update_service"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should delete service from load balancer", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.deleteServiceFromLoadBalancer(1, 80);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/delete_service"),
        expect.objectContaining({
          body: JSON.stringify({ listen_port: 80 }),
        })
      );
    });

    it("should change load balancer algorithm", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeLoadBalancerAlgorithm(1, "least_connections");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/change_algorithm"),
        expect.objectContaining({
          body: JSON.stringify({ type: "least_connections" }),
        })
      );
    });

    it("should change load balancer type", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeLoadBalancerType(1, "lb21");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/change_type"),
        expect.objectContaining({
          body: JSON.stringify({ load_balancer_type: "lb21" }),
        })
      );
    });

    it("should attach load balancer to network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.attachLoadBalancerToNetwork(1, 123, "10.0.0.5");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/attach_to_network"),
        expect.objectContaining({
          body: JSON.stringify({ network: 123, ip: "10.0.0.5" }),
        })
      );
    });

    it("should detach load balancer from network", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.detachLoadBalancerFromNetwork(1, 123);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/load_balancers/1/actions/detach_from_network"
        ),
        expect.objectContaining({
          body: JSON.stringify({ network: 123 }),
        })
      );
    });

    it("should enable load balancer public interface", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.enableLoadBalancerPublicInterface(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/load_balancers/1/actions/enable_public_interface"
        ),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should disable load balancer public interface", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.disableLoadBalancerPublicInterface(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/load_balancers/1/actions/disable_public_interface"
        ),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should change load balancer protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeLoadBalancerProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/load_balancers/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });
  });

  describe("Images", () => {
    it("should list images", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("images", [{ id: 1 }], null)
      );

      const result = await client.listImages();
      expect(result).toHaveLength(1);
    });

    it("should list images with filters", async () => {
      mockFetch.mockResolvedValueOnce(paginatedResponse("images", [], null));

      await client.listImages({ type: "system", architecture: "x86" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("type=system"),
        expect.any(Object)
      );
    });

    it("should get image by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ image: { id: 1, name: "ubuntu" } })
      );

      const result = await client.getImage(1);
      expect(result.name).toBe("ubuntu");
    });

    it("should update image", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ image: { id: 1, description: "Updated" } })
      );

      const result = await client.updateImage(1, { description: "Updated" });
      expect(result.image.description).toBe("Updated");
    });

    it("should delete image", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteImage(1)).resolves.not.toThrow();
    });

    it("should change image protection", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ action: { id: 1 } }));

      await client.changeImageProtection(1, true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/images/1/actions/change_protection"),
        expect.objectContaining({
          body: JSON.stringify({ delete: true }),
        })
      );
    });
  });

  describe("SSH Keys", () => {
    it("should list SSH keys", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("ssh_keys", [{ id: 1 }], null)
      );

      const result = await client.listSshKeys();
      expect(result).toHaveLength(1);
    });

    it("should get SSH key by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ssh_key: { id: 1, name: "mykey" } })
      );

      const result = await client.getSshKey(1);
      expect(result.name).toBe("mykey");
    });

    it("should create SSH key", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ssh_key: { id: 1 } }));

      const result = await client.createSshKey({
        name: "mykey",
        public_key: "ssh-ed25519 AAAA...",
      });
      expect(result.ssh_key.id).toBe(1);
    });

    it("should update SSH key", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ssh_key: { id: 1, name: "renamed" } })
      );

      const result = await client.updateSshKey(1, { name: "renamed" });
      expect(result.ssh_key.name).toBe("renamed");
    });

    it("should delete SSH key", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteSshKey(1)).resolves.not.toThrow();
    });
  });

  describe("Certificates", () => {
    it("should list certificates", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("certificates", [{ id: 1 }], null)
      );

      const result = await client.listCertificates();
      expect(result).toHaveLength(1);
    });

    it("should get certificate by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ certificate: { id: 1, name: "cert1" } })
      );

      const result = await client.getCertificate(1);
      expect(result.name).toBe("cert1");
    });

    it("should create certificate", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ certificate: { id: 1 }, action: { id: 1 } })
      );

      const result = await client.createCertificate({
        name: "cert1",
        type: "managed",
        domain_names: ["example.com"],
      });
      expect(result.certificate.id).toBe(1);
    });

    it("should update certificate", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ certificate: { id: 1, name: "renamed" } })
      );

      const result = await client.updateCertificate(1, { name: "renamed" });
      expect(result.certificate.name).toBe("renamed");
    });

    it("should delete certificate", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deleteCertificate(1)).resolves.not.toThrow();
    });
  });

  describe("Placement Groups", () => {
    it("should list placement groups", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("placement_groups", [{ id: 1 }], null)
      );

      const result = await client.listPlacementGroups();
      expect(result).toHaveLength(1);
    });

    it("should get placement group by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ placement_group: { id: 1, name: "pg1" } })
      );

      const result = await client.getPlacementGroup(1);
      expect(result.name).toBe("pg1");
    });

    it("should create placement group", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ placement_group: { id: 1 } })
      );

      const result = await client.createPlacementGroup({
        name: "pg1",
        type: "spread",
      });
      expect(result.placement_group.id).toBe(1);
    });

    it("should update placement group", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ placement_group: { id: 1, name: "renamed" } })
      );

      const result = await client.updatePlacementGroup(1, { name: "renamed" });
      expect(result.placement_group.name).toBe("renamed");
    });

    it("should delete placement group", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(client.deletePlacementGroup(1)).resolves.not.toThrow();
    });
  });

  describe("Actions", () => {
    it("should get action by id", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          action: { id: 1, command: "create_server", status: "success" },
        })
      );

      const result = await client.getAction(1);
      expect(result.command).toBe("create_server");
      expect(result.status).toBe("success");
    });

    it("should list actions", async () => {
      mockFetch.mockResolvedValueOnce(
        paginatedResponse("actions", [{ id: 1 }, { id: 2 }], null)
      );

      const result = await client.listActions();
      expect(result).toHaveLength(2);
    });

    it("should list actions with filters", async () => {
      mockFetch.mockResolvedValueOnce(paginatedResponse("actions", [], null));

      await client.listActions({ status: "running", sort: "id:asc" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=running"),
        expect.any(Object)
      );
    });
  });
});
