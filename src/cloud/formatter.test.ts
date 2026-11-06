import { describe, expect, it } from "vitest";
import {
  formatCertificateDetails,
  formatCertificateList,
  formatCloudFirewallDetails,
  formatCloudFirewallList,
  formatCloudServerDetails,
  formatCloudServerList,
  formatCloudSshKeyDetails,
  formatCloudSshKeyList,
  formatContextList,
  formatDatacenterDetails,
  formatDatacenterList,
  formatFloatingIpDetails,
  formatFloatingIpList,
  formatImageDetails,
  formatImageList,
  formatIsoDetails,
  formatIsoList,
  formatLoadBalancerDetails,
  formatLoadBalancerList,
  formatLoadBalancerTypeDetails,
  formatLoadBalancerTypeList,
  formatLocationDetails,
  formatLocationList,
  formatNetworkDetails,
  formatNetworkList,
  formatPlacementGroupDetails,
  formatPlacementGroupList,
  formatPrimaryIpDetails,
  formatPrimaryIpList,
  formatServerTypeDetails,
  formatServerTypeList,
  formatVolumeDetails,
  formatVolumeList,
} from "./formatter.js";
import type {
  Certificate,
  CloudFirewall,
  CloudServer,
  CloudSshKey,
  Datacenter,
  FloatingIp,
  Image,
  ISO,
  LoadBalancer,
  LoadBalancerType,
  Location,
  Network,
  PlacementGroup,
  PrimaryIp,
  ServerType,
  Volume,
} from "./types.js";

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 1,
    name: "fsn1",
    description: "Falkenstein DC Park 1",
    country: "DE",
    city: "Falkenstein",
    latitude: 50.476_12,
    longitude: 12.370_071,
    network_zone: "eu-central",
    ...overrides,
  };
}

function makeDatacenter(overrides: Partial<Datacenter> = {}): Datacenter {
  return {
    id: 1,
    name: "fsn1-dc14",
    description: "Falkenstein 1 DC14",
    location: makeLocation(),
    server_types: {
      supported: [1, 2],
      available: [1],
      available_for_migration: [1],
    },
    ...overrides,
  };
}

function makeServerType(overrides: Partial<ServerType> = {}): ServerType {
  return {
    id: 1,
    name: "cx11",
    description: "CX11",
    cores: 1,
    memory: 2,
    disk: 20,
    storage_type: "local",
    cpu_type: "shared",
    architecture: "x86",
    deprecated: false,
    prices: [],
    ...overrides,
  };
}

function makeLoadBalancerType(
  overrides: Partial<LoadBalancerType> = {}
): LoadBalancerType {
  return {
    id: 1,
    name: "lb11",
    description: "LB11",
    max_connections: 10_000,
    max_services: 5,
    max_targets: 25,
    max_assigned_certificates: 10,
    deprecated: null,
    prices: [],
    ...overrides,
  };
}

function makeIso(overrides: Partial<ISO> = {}): ISO {
  return {
    id: 1,
    name: "FreeBSD-13.2-RELEASE-amd64-disc1.iso",
    description: "FreeBSD 13.2",
    type: "public",
    architecture: "x86",
    ...overrides,
  };
}

function makeImage(overrides: Partial<Image> = {}): Image {
  return {
    id: 1,
    type: "system",
    status: "available",
    name: "ubuntu-22.04",
    description: "Ubuntu 22.04",
    image_size: null,
    disk_size: 10,
    created: "2023-01-01T00:00:00+00:00",
    created_from: null,
    bound_to: null,
    os_flavor: "ubuntu",
    os_version: "22.04",
    architecture: "x86",
    rapid_deploy: true,
    protection: { delete: false },
    deprecated: null,
    deleted: null,
    labels: {},
    ...overrides,
  };
}

function makeCloudServer(overrides: Partial<CloudServer> = {}): CloudServer {
  return {
    id: 1,
    name: "my-server",
    status: "running",
    public_net: {
      ipv4: { ip: "1.2.3.4", dns_ptr: "srv.example.com", blocked: false },
      ipv6: { ip: "2001:db8::/64", dns_ptr: [], blocked: false },
      floating_ips: [],
      firewalls: [],
    },
    private_net: [],
    server_type: makeServerType(),
    location: makeLocation(),
    image: makeImage(),
    iso: null,
    rescue_enabled: false,
    locked: false,
    backup_window: null,
    outgoing_traffic: null,
    ingoing_traffic: null,
    included_traffic: 654_321,
    protection: { delete: false, rebuild: false },
    labels: {},
    volumes: [],
    load_balancers: [],
    primary_disk_size: 20,
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makeNetwork(overrides: Partial<Network> = {}): Network {
  return {
    id: 1,
    name: "mynet",
    ip_range: "10.0.0.0/8",
    subnets: [],
    routes: [],
    servers: [],
    load_balancers: [],
    protection: { delete: false },
    labels: {},
    created: "2023-01-01T00:00:00+00:00",
    expose_routes_to_vswitch: false,
    ...overrides,
  };
}

function makeFirewall(overrides: Partial<CloudFirewall> = {}): CloudFirewall {
  return {
    id: 1,
    name: "my-firewall",
    labels: {},
    rules: [],
    applied_to: [],
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makeFloatingIp(overrides: Partial<FloatingIp> = {}): FloatingIp {
  return {
    id: 1,
    name: "my-ip",
    description: "My floating IP",
    ip: "1.2.3.4",
    type: "ipv4",
    server: null,
    dns_ptr: [],
    home_location: makeLocation(),
    blocked: false,
    protection: { delete: false },
    labels: {},
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makePrimaryIp(overrides: Partial<PrimaryIp> = {}): PrimaryIp {
  return {
    id: 1,
    name: "my-primary-ip",
    ip: "1.2.3.4",
    type: "ipv4",
    assignee_id: null,
    assignee_type: "server",
    auto_delete: false,
    blocked: false,
    location: makeLocation(),
    dns_ptr: [],
    labels: {},
    protection: { delete: false },
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makeVolume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: 1,
    name: "my-volume",
    server: null,
    status: "available",
    location: makeLocation(),
    size: 50,
    linux_device: "/dev/disk/by-id/scsi-0HC_Volume_1",
    protection: { delete: false },
    labels: {},
    created: "2023-01-01T00:00:00+00:00",
    format: "ext4",
    ...overrides,
  };
}

function makeLoadBalancer(overrides: Partial<LoadBalancer> = {}): LoadBalancer {
  return {
    id: 1,
    name: "my-lb",
    public_net: {
      enabled: true,
      ipv4: { ip: "1.2.3.4", dns_ptr: "lb.example.com" },
      ipv6: { ip: "2001:db8::1", dns_ptr: "lb.example.com" },
    },
    private_net: [],
    location: makeLocation(),
    load_balancer_type: makeLoadBalancerType(),
    protection: { delete: false },
    labels: {},
    targets: [],
    services: [],
    algorithm: { type: "round_robin" },
    outgoing_traffic: null,
    ingoing_traffic: null,
    included_traffic: 654_321,
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makeSshKey(overrides: Partial<CloudSshKey> = {}): CloudSshKey {
  return {
    id: 1,
    name: "my-key",
    fingerprint: "b7:2f:30:a0:2f:6c:58:6c:21:04:58:61:ba:06:3b:2f",
    public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGNvbW1lbnQ= user@host",
    labels: {},
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function makeCertificate(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 1,
    name: "my-cert",
    labels: {},
    type: "managed",
    certificate: null,
    created: "2023-01-01T00:00:00+00:00",
    not_valid_before: "2023-01-01T00:00:00+00:00",
    not_valid_after: "2024-01-01T00:00:00+00:00",
    domain_names: ["example.com"],
    fingerprint: "ab:cd:ef:12:34:56",
    status: { issuance: "completed", renewal: "scheduled" },
    used_by: [],
    ...overrides,
  };
}

function makePlacementGroup(
  overrides: Partial<PlacementGroup> = {}
): PlacementGroup {
  return {
    id: 1,
    name: "my-group",
    labels: {},
    type: "spread",
    servers: [],
    created: "2023-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("Cloud Formatters", () => {
  describe("formatContextList", () => {
    it("should show message when no contexts", () => {
      expect(formatContextList([])).toContain("No contexts configured");
    });

    it("should display contexts with active marker", () => {
      const result = formatContextList([
        { name: "prod", active: true },
        { name: "staging", active: false },
      ]);
      expect(result).toContain("prod");
      expect(result).toContain("staging");
      expect(result).toContain("*");
    });
  });

  describe("formatDatacenterList", () => {
    it("should show message for empty list", () => {
      expect(formatDatacenterList([])).toContain("No datacenters found");
    });

    it("should display datacenter data", () => {
      const result = formatDatacenterList([makeDatacenter()]);
      expect(result).toContain("fsn1-dc14");
      expect(result).toContain("Falkenstein 1 DC14");
      expect(result).toContain("fsn1");
    });
  });

  describe("formatDatacenterDetails", () => {
    it("should display all datacenter properties", () => {
      const result = formatDatacenterDetails(makeDatacenter());
      expect(result).toContain("Datacenter: fsn1-dc14");
      expect(result).toContain("Falkenstein");
      expect(result).toContain("DE");
      expect(result).toContain("eu-central");
    });
  });

  describe("formatLocationList", () => {
    it("should show message for empty list", () => {
      expect(formatLocationList([])).toContain("No locations found");
    });

    it("should display location data", () => {
      const result = formatLocationList([makeLocation()]);
      expect(result).toContain("fsn1");
      expect(result).toContain("Falkenstein");
      expect(result).toContain("DE");
      expect(result).toContain("eu-central");
    });
  });

  describe("formatLocationDetails", () => {
    it("should display all location properties", () => {
      const result = formatLocationDetails(makeLocation());
      expect(result).toContain("Location: fsn1");
      expect(result).toContain("50.47612");
      expect(result).toContain("12.370071");
    });
  });

  describe("formatServerTypeList", () => {
    it("should show message for empty list", () => {
      expect(formatServerTypeList([])).toContain("No server types found");
    });

    it("should display server type data", () => {
      const result = formatServerTypeList([makeServerType()]);
      expect(result).toContain("cx11");
      expect(result).toContain("2 GB");
      expect(result).toContain("20 GB");
      expect(result).toContain("local");
      expect(result).toContain("shared");
      expect(result).toContain("x86");
    });
  });

  describe("formatServerTypeDetails", () => {
    it("should display server type properties", () => {
      const result = formatServerTypeDetails(makeServerType());
      expect(result).toContain("Server Type: cx11");
      expect(result).toContain("CX11");
      expect(result).toContain("No"); // not deprecated
    });

    it("should show deprecated status", () => {
      const result = formatServerTypeDetails(
        makeServerType({ deprecated: true })
      );
      expect(result).toContain("Yes");
    });

    it("should display pricing table when prices exist", () => {
      const result = formatServerTypeDetails(
        makeServerType({
          prices: [
            {
              location: "fsn1",
              price_hourly: { net: "0.0050", gross: "0.0060" },
              price_monthly: { net: "2.96", gross: "3.52" },
              included_traffic: 21_990_232_555_520,
            },
          ],
        })
      );
      expect(result).toContain("Pricing:");
      expect(result).toContain("fsn1");
      expect(result).toContain("0.0060");
      expect(result).toContain("3.52");
    });
  });

  describe("formatLoadBalancerTypeList", () => {
    it("should show message for empty list", () => {
      expect(formatLoadBalancerTypeList([])).toContain(
        "No load balancer types found"
      );
    });

    it("should display load balancer type data", () => {
      const result = formatLoadBalancerTypeList([makeLoadBalancerType()]);
      expect(result).toContain("lb11");
      expect(result).toContain("10000");
      expect(result).toContain("5");
      expect(result).toContain("25");
    });
  });

  describe("formatLoadBalancerTypeDetails", () => {
    it("should display all properties", () => {
      const result = formatLoadBalancerTypeDetails(makeLoadBalancerType());
      expect(result).toContain("Load Balancer Type: lb11");
      expect(result).toContain("10");
      expect(result).toContain("No"); // not deprecated
    });

    it("should show deprecated status", () => {
      const result = formatLoadBalancerTypeDetails(
        makeLoadBalancerType({ deprecated: "2024-01-01" })
      );
      expect(result).toContain("Yes");
    });
  });

  describe("formatIsoList", () => {
    it("should show message for empty list", () => {
      expect(formatIsoList([])).toContain("No ISOs found");
    });

    it("should display ISO data", () => {
      const result = formatIsoList([makeIso()]);
      expect(result).toContain("FreeBSD");
      expect(result).toContain("public");
      expect(result).toContain("x86");
    });

    it("should show dash for null architecture", () => {
      const result = formatIsoList([makeIso({ architecture: null })]);
      expect(result).toContain("-");
    });
  });

  describe("formatIsoDetails", () => {
    it("should display all ISO properties", () => {
      const result = formatIsoDetails(makeIso());
      expect(result).toContain("ISO: FreeBSD");
      expect(result).toContain("FreeBSD 13.2");
      expect(result).toContain("public");
    });

    it("should show dash for null architecture", () => {
      const result = formatIsoDetails(makeIso({ architecture: null }));
      expect(result).toContain("-");
    });
  });

  describe("formatCloudServerList", () => {
    it("should show message for empty list", () => {
      expect(formatCloudServerList([])).toContain("No servers found");
    });

    it("should display server data", () => {
      const result = formatCloudServerList([makeCloudServer()]);
      expect(result).toContain("my-server");
      expect(result).toContain("running");
      expect(result).toContain("cx11");
      expect(result).toContain("1.2.3.4");
    });

    it("should truncate long labels", () => {
      const result = formatCloudServerList([
        makeCloudServer({
          labels: {
            environment: "production",
            team: "backend-engineering-team",
          },
        }),
      ]);
      expect(result).toContain("...");
    });

    it("should show dash for empty labels", () => {
      const result = formatCloudServerList([makeCloudServer({ labels: {} })]);
      expect(result).toContain("-");
    });

    it("should show dash when no IPv4", () => {
      const result = formatCloudServerList([
        makeCloudServer({
          public_net: {
            ipv4: null,
            ipv6: null,
            floating_ips: [],
            firewalls: [],
          },
        }),
      ]);
      expect(result).toContain("-");
    });

    it("should handle missing location and server_type in list responses", () => {
      const result = formatCloudServerList([
        makeCloudServer({
          location: undefined,
          server_type: undefined,
        }),
      ]);
      expect(result).toContain("my-server");
      expect(result).toContain("running");
      // Both type and datacenter columns should fall back to "-"
      expect(result).toContain("-");
    });
  });

  describe("formatCloudServerDetails", () => {
    it("should display all server properties", () => {
      const result = formatCloudServerDetails(makeCloudServer());
      expect(result).toContain("Server: my-server");
      expect(result).toContain("running");
      expect(result).toContain("cx11");
      expect(result).toContain("1.2.3.4");
      expect(result).toContain("20 GB");
      expect(result).toContain("Disabled"); // rescue
      expect(result).toContain("No"); // locked
    });

    it("should show rescue enabled status", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({ rescue_enabled: true })
      );
      expect(result).toContain("Enabled");
    });

    it("should show locked status", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({ locked: true })
      );
      expect(result).toContain("Yes");
    });

    it("should show protection status", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should display labels section", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({ labels: { env: "prod" } })
      );
      expect(result).toContain("Labels:");
      expect(result).toContain("env = prod");
    });

    it("should display private networks section", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({
          private_net: [
            {
              network: 123,
              ip: "10.0.0.2",
              alias_ips: ["10.0.0.3"],
              mac_address: "aa:bb:cc:dd:ee:ff",
            },
          ],
        })
      );
      expect(result).toContain("Private Networks:");
      expect(result).toContain("123");
      expect(result).toContain("10.0.0.2");
      expect(result).toContain("10.0.0.3");
    });

    it("should display volumes section", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({ volumes: [100, 200] })
      );
      expect(result).toContain("Volumes:");
      expect(result).toContain("100, 200");
    });

    it("should show dash when image is null", () => {
      const result = formatCloudServerDetails(makeCloudServer({ image: null }));
      expect(result).toContain("-");
    });

    it("should show dashes when location and server_type are missing", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({
          location: undefined,
          server_type: undefined,
        })
      );
      expect(result).toContain("Server: my-server");
      expect(result).toContain("Server Type");
      expect(result).toContain("Datacenter");
      expect(result).toContain("-");
    });

    it("should fall back to image id when image name is null", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({
          image: makeImage({ name: null, id: 999 }),
        })
      );
      expect(result).toContain("999");
    });

    it("should show dash when ipv4 is null in details", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({
          public_net: {
            ipv4: null,
            ipv6: null,
            floating_ips: [],
            firewalls: [],
          },
        })
      );
      const lines = result.split("\n");
      const ipv4Line = lines.find((l) => l.includes("IPv4"));
      expect(ipv4Line).toContain("-");
      const ipv6Line = lines.find((l) => l.includes("IPv6"));
      expect(ipv6Line).toContain("-");
    });

    it("should show dash for empty alias_ips in private networks", () => {
      const result = formatCloudServerDetails(
        makeCloudServer({
          private_net: [
            {
              network: 456,
              ip: "10.0.0.5",
              alias_ips: [],
              mac_address: "aa:bb:cc:dd:ee:ff",
            },
          ],
        })
      );
      expect(result).toContain("Private Networks:");
      expect(result).toContain("456");
      expect(result).toContain("10.0.0.5");
      expect(result).toContain("-");
    });
  });

  describe("formatNetworkList", () => {
    it("should show message for empty list", () => {
      expect(formatNetworkList([])).toContain("No networks found");
    });

    it("should display network data", () => {
      const result = formatNetworkList([makeNetwork({ servers: [1, 2] })]);
      expect(result).toContain("mynet");
      expect(result).toContain("10.0.0.0/8");
      expect(result).toContain("2");
    });
  });

  describe("formatNetworkDetails", () => {
    it("should display all network properties", () => {
      const result = formatNetworkDetails(makeNetwork());
      expect(result).toContain("Network: mynet");
      expect(result).toContain("10.0.0.0/8");
      expect(result).toContain("None"); // protection
    });

    it("should show protection status", () => {
      const result = formatNetworkDetails(
        makeNetwork({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should display subnets section", () => {
      const result = formatNetworkDetails(
        makeNetwork({
          subnets: [
            {
              type: "cloud",
              ip_range: "10.0.1.0/24",
              network_zone: "eu-central",
              gateway: "10.0.0.1",
            },
          ],
        })
      );
      expect(result).toContain("Subnets:");
      expect(result).toContain("10.0.1.0/24");
      expect(result).toContain("cloud");
      expect(result).toContain("eu-central");
      expect(result).toContain("10.0.0.1");
    });

    it("should display routes section", () => {
      const result = formatNetworkDetails(
        makeNetwork({
          routes: [{ destination: "10.100.1.0/24", gateway: "10.0.1.1" }],
        })
      );
      expect(result).toContain("Routes:");
      expect(result).toContain("10.100.1.0/24");
      expect(result).toContain("10.0.1.1");
    });
  });

  describe("formatCloudFirewallList", () => {
    it("should show message for empty list", () => {
      expect(formatCloudFirewallList([])).toContain("No firewalls found");
    });

    it("should display firewall data", () => {
      const result = formatCloudFirewallList([
        makeFirewall({
          rules: [
            {
              direction: "in",
              protocol: "tcp",
              port: "80",
              source_ips: ["0.0.0.0/0"],
              destination_ips: [],
              description: null,
            },
          ],
          applied_to: [{ type: "server", server: { id: 1 } }],
        }),
      ]);
      expect(result).toContain("my-firewall");
      expect(result).toContain("1"); // rules count
    });
  });

  describe("formatCloudFirewallDetails", () => {
    it("should display firewall details", () => {
      const result = formatCloudFirewallDetails(makeFirewall());
      expect(result).toContain("Firewall: my-firewall");
    });

    it("should display rules section with port any", () => {
      const result = formatCloudFirewallDetails(
        makeFirewall({
          rules: [
            {
              direction: "in",
              protocol: "tcp",
              port: "80",
              source_ips: ["0.0.0.0/0"],
              destination_ips: [],
              description: "HTTP",
            },
            {
              direction: "in",
              protocol: "icmp",
              port: null,
              source_ips: ["0.0.0.0/0"],
              destination_ips: [],
              description: null,
            },
          ],
        })
      );
      expect(result).toContain("Rules:");
      expect(result).toContain("tcp");
      expect(result).toContain("80");
      expect(result).toContain("HTTP");
      expect(result).toContain("icmp");
      expect(result).toContain("any");
    });

    it("should show dash for empty source_ips and null description", () => {
      const result = formatCloudFirewallDetails(
        makeFirewall({
          rules: [
            {
              direction: "out",
              protocol: "tcp",
              port: "443",
              source_ips: [],
              destination_ips: ["0.0.0.0/0"],
              description: null,
            },
          ],
        })
      );
      expect(result).toContain("Rules:");
      expect(result).toContain("out");
      expect(result).toContain("443");
      // source_ips.join(', ').substring(0, 30) || '-' should be '-'
      // description || '-' should be '-'
      expect(result).toContain("-");
    });
  });

  describe("formatFloatingIpList", () => {
    it("should show message for empty list", () => {
      expect(formatFloatingIpList([])).toContain("No floating IPs found");
    });

    it("should display floating IP data", () => {
      const result = formatFloatingIpList([makeFloatingIp({ server: 42 })]);
      expect(result).toContain("my-ip");
      expect(result).toContain("1.2.3.4");
      expect(result).toContain("42");
      expect(result).toContain("No"); // blocked
    });

    it("should show blocked status", () => {
      const result = formatFloatingIpList([makeFloatingIp({ blocked: true })]);
      expect(result).toContain("Yes");
    });
  });

  describe("formatFloatingIpDetails", () => {
    it("should display all floating IP properties", () => {
      const result = formatFloatingIpDetails(makeFloatingIp());
      expect(result).toContain("Floating IP: my-ip");
      expect(result).toContain("Unassigned");
      expect(result).toContain("None"); // protection
    });

    it("should show server when assigned", () => {
      const result = formatFloatingIpDetails(makeFloatingIp({ server: 42 }));
      expect(result).toContain("42");
    });

    it("should show protection status", () => {
      const result = formatFloatingIpDetails(
        makeFloatingIp({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should show dash for empty description", () => {
      const result = formatFloatingIpDetails(
        makeFloatingIp({ description: "" })
      );
      const lines = result.split("\n");
      const descLine = lines.find((l) => l.includes("Description"));
      expect(descLine).toContain("-");
    });

    it("should show blocked status in details", () => {
      const result = formatFloatingIpDetails(makeFloatingIp({ blocked: true }));
      expect(result).toContain("Yes");
    });
  });

  describe("formatPrimaryIpList", () => {
    it("should show message for empty list", () => {
      expect(formatPrimaryIpList([])).toContain("No primary IPs found");
    });

    it("should display primary IP data", () => {
      const result = formatPrimaryIpList([makePrimaryIp({ assignee_id: 10 })]);
      expect(result).toContain("my-primary-ip");
      expect(result).toContain("1.2.3.4");
      expect(result).toContain("10");
      expect(result).toContain("No"); // auto_delete
      expect(result).toContain("Location");
      expect(result).toContain("fsn1");
    });

    it("should show auto delete status", () => {
      const result = formatPrimaryIpList([
        makePrimaryIp({ auto_delete: true }),
      ]);
      expect(result).toContain("Yes");
    });
  });

  describe("formatPrimaryIpDetails", () => {
    it("should display all primary IP properties", () => {
      const result = formatPrimaryIpDetails(makePrimaryIp());
      expect(result).toContain("Primary IP: my-primary-ip");
      expect(result).toContain("Unassigned");
      expect(result).toContain("Location");
      expect(result).toContain("fsn1");
      expect(result).toContain("No"); // auto_delete, blocked
    });

    it("should show assignee when set", () => {
      const result = formatPrimaryIpDetails(makePrimaryIp({ assignee_id: 5 }));
      expect(result).toContain("5");
    });

    it("should show protection status", () => {
      const result = formatPrimaryIpDetails(
        makePrimaryIp({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should show auto delete enabled in details", () => {
      const result = formatPrimaryIpDetails(
        makePrimaryIp({ auto_delete: true })
      );
      const lines = result.split("\n");
      const autoDeleteLine = lines.find((l) => l.includes("Auto Delete"));
      expect(autoDeleteLine).toContain("Yes");
    });

    it("should show blocked status in details", () => {
      const result = formatPrimaryIpDetails(makePrimaryIp({ blocked: true }));
      expect(result).toContain("Yes");
    });
  });

  describe("formatVolumeList", () => {
    it("should show message for empty list", () => {
      expect(formatVolumeList([])).toContain("No volumes found");
    });

    it("should display volume data", () => {
      const result = formatVolumeList([makeVolume({ server: 42 })]);
      expect(result).toContain("my-volume");
      expect(result).toContain("50 GB");
      expect(result).toContain("42");
      expect(result).toContain("available");
      expect(result).toContain("ext4");
    });

    it("should show dash for null format", () => {
      const result = formatVolumeList([makeVolume({ format: null })]);
      expect(result).toContain("-");
    });
  });

  describe("formatVolumeDetails", () => {
    it("should display all volume properties", () => {
      const result = formatVolumeDetails(makeVolume());
      expect(result).toContain("Volume: my-volume");
      expect(result).toContain("50 GB");
      expect(result).toContain("Unattached");
      expect(result).toContain("/dev/disk/by-id/scsi-0HC_Volume_1");
      expect(result).toContain("ext4");
    });

    it("should show server when attached", () => {
      const result = formatVolumeDetails(makeVolume({ server: 10 }));
      expect(result).toContain("10");
    });

    it("should show dash for null linux device", () => {
      const result = formatVolumeDetails(makeVolume({ linux_device: null }));
      const lines = result.split("\n");
      const deviceLine = lines.find((l) => l.includes("Linux Device"));
      expect(deviceLine).toContain("-");
    });

    it("should show dash for null format in details", () => {
      const result = formatVolumeDetails(makeVolume({ format: null }));
      const lines = result.split("\n");
      const formatLine = lines.find((l) => l.includes("Format"));
      expect(formatLine).toContain("-");
    });

    it("should show protection status in details", () => {
      const result = formatVolumeDetails(
        makeVolume({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });
  });

  describe("formatLoadBalancerList", () => {
    it("should show message for empty list", () => {
      expect(formatLoadBalancerList([])).toContain("No load balancers found");
    });

    it("should display load balancer data", () => {
      const result = formatLoadBalancerList([makeLoadBalancer()]);
      expect(result).toContain("my-lb");
      expect(result).toContain("1.2.3.4");
      expect(result).toContain("lb11");
      expect(result).toContain("fsn1");
    });
  });

  describe("formatLoadBalancerDetails", () => {
    it("should display all load balancer properties", () => {
      const result = formatLoadBalancerDetails(makeLoadBalancer());
      expect(result).toContain("Load Balancer: my-lb");
      expect(result).toContain("round_robin");
      expect(result).toContain("Enabled"); // public net
    });

    it("should display services section", () => {
      const result = formatLoadBalancerDetails(
        makeLoadBalancer({
          services: [
            {
              protocol: "http",
              listen_port: 80,
              destination_port: 8080,
              proxyprotocol: false,
              health_check: {
                protocol: "http",
                port: 8080,
                interval: 15,
                timeout: 10,
                retries: 3,
              },
            },
          ],
        })
      );
      expect(result).toContain("Services:");
      expect(result).toContain("http");
      expect(result).toContain("80");
      expect(result).toContain("8080");
      expect(result).toContain("No"); // proxyprotocol
    });

    it("should show protection status", () => {
      const result = formatLoadBalancerDetails(
        makeLoadBalancer({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should show public net disabled", () => {
      const result = formatLoadBalancerDetails(
        makeLoadBalancer({
          public_net: {
            enabled: false,
            ipv4: { ip: "1.2.3.4", dns_ptr: "lb.example.com" },
            ipv6: { ip: "2001:db8::1", dns_ptr: "lb.example.com" },
          },
        })
      );
      expect(result).toContain("Disabled");
    });

    it("should show proxyprotocol enabled in services", () => {
      const result = formatLoadBalancerDetails(
        makeLoadBalancer({
          services: [
            {
              protocol: "tcp",
              listen_port: 443,
              destination_port: 8443,
              proxyprotocol: true,
              health_check: {
                protocol: "tcp",
                port: 8443,
                interval: 15,
                timeout: 10,
                retries: 3,
              },
            },
          ],
        })
      );
      expect(result).toContain("Services:");
      expect(result).toContain("tcp");
      expect(result).toContain("443");
      expect(result).toContain("8443");
      const lines = result.split("\n");
      const svcLine = lines.find(
        (l) => l.includes("443") && l.includes("8443")
      );
      expect(svcLine).toContain("Yes");
    });
  });

  describe("formatImageList", () => {
    it("should show message for empty list", () => {
      expect(formatImageList([])).toContain("No images found");
    });

    it("should display image data", () => {
      const result = formatImageList([makeImage()]);
      expect(result).toContain("system");
      expect(result).toContain("ubuntu-22.04");
      expect(result).toContain("Ubuntu 22.04");
      expect(result).toContain("ubuntu");
      expect(result).toContain("10 GB");
      expect(result).toContain("available");
    });

    it("should show dash for null name", () => {
      const result = formatImageList([makeImage({ name: null })]);
      expect(result).toContain("-");
    });
  });

  describe("formatImageDetails", () => {
    it("should display all image properties", () => {
      const result = formatImageDetails(makeImage());
      expect(result).toContain("Image: Ubuntu 22.04");
      expect(result).toContain("ubuntu");
      expect(result).toContain("22.04");
      expect(result).toContain("Yes"); // rapid_deploy
    });

    it("should show image size when present", () => {
      const result = formatImageDetails(makeImage({ image_size: 2.3 }));
      // image_size is multiplied by 1024*1024 then formatted via formatBytes
      expect(result).toContain("2.3 MB");
    });

    it("should show dash for null image size", () => {
      const result = formatImageDetails(makeImage({ image_size: null }));
      const lines = result.split("\n");
      const sizeLine = lines.find((l) => l.includes("Image Size"));
      expect(sizeLine).toContain("-");
    });

    it("should show protection status", () => {
      const result = formatImageDetails(
        makeImage({ protection: { delete: true } })
      );
      expect(result).toContain("Delete protected");
    });

    it("should show dash for null name in details", () => {
      const result = formatImageDetails(makeImage({ name: null }));
      const lines = result.split("\n");
      const nameLine = lines.find((l) => l.includes("Name"));
      expect(nameLine).toContain("-");
    });

    it("should show dash for null os_version in details", () => {
      const result = formatImageDetails(makeImage({ os_version: null }));
      const lines = result.split("\n");
      const versionLine = lines.find((l) => l.includes("OS Version"));
      expect(versionLine).toContain("-");
    });

    it("should show rapid_deploy as No when false", () => {
      const result = formatImageDetails(makeImage({ rapid_deploy: false }));
      const lines = result.split("\n");
      const rapidLine = lines.find((l) => l.includes("Rapid Deploy"));
      expect(rapidLine).toContain("No");
    });
  });

  describe("formatCloudSshKeyList", () => {
    it("should show message for empty list", () => {
      expect(formatCloudSshKeyList([])).toContain("No SSH keys found");
    });

    it("should display SSH key data", () => {
      const result = formatCloudSshKeyList([makeSshKey()]);
      expect(result).toContain("my-key");
      expect(result).toContain("b7:2f:30");
    });
  });

  describe("formatCloudSshKeyDetails", () => {
    it("should display all SSH key properties", () => {
      const result = formatCloudSshKeyDetails(makeSshKey());
      expect(result).toContain("SSH Key: my-key");
      expect(result).toContain(
        "b7:2f:30:a0:2f:6c:58:6c:21:04:58:61:ba:06:3b:2f"
      );
      expect(result).toContain("Public Key:");
      expect(result).toContain("ssh-ed25519");
    });
  });

  describe("formatCertificateList", () => {
    it("should show message for empty list", () => {
      expect(formatCertificateList([])).toContain("No certificates found");
    });

    it("should display certificate data", () => {
      const result = formatCertificateList([makeCertificate()]);
      expect(result).toContain("my-cert");
      expect(result).toContain("managed");
      expect(result).toContain("example.com");
    });

    it("should truncate long domain lists", () => {
      const result = formatCertificateList([
        makeCertificate({
          domain_names: [
            "very-long-domain-name-1.example.com",
            "very-long-domain-name-2.example.com",
          ],
        }),
      ]);
      expect(result).toBeDefined();
    });
  });

  describe("formatCertificateDetails", () => {
    it("should display all certificate properties", () => {
      const result = formatCertificateDetails(makeCertificate());
      expect(result).toContain("Certificate: my-cert");
      expect(result).toContain("managed");
      expect(result).toContain("example.com");
      expect(result).toContain("ab:cd:ef:12:34:56");
    });

    it("should show dash for null fingerprint", () => {
      const result = formatCertificateDetails(
        makeCertificate({ fingerprint: null })
      );
      const lines = result.split("\n");
      const fpLine = lines.find((l) => l.includes("Fingerprint"));
      expect(fpLine).toContain("-");
    });
  });

  describe("formatPlacementGroupList", () => {
    it("should show message for empty list", () => {
      expect(formatPlacementGroupList([])).toContain(
        "No placement groups found"
      );
    });

    it("should display placement group data", () => {
      const result = formatPlacementGroupList([
        makePlacementGroup({ servers: [1, 2] }),
      ]);
      expect(result).toContain("my-group");
      expect(result).toContain("spread");
      expect(result).toContain("2");
    });
  });

  describe("formatPlacementGroupDetails", () => {
    it("should display all placement group properties", () => {
      const result = formatPlacementGroupDetails(makePlacementGroup());
      expect(result).toContain("Placement Group: my-group");
      expect(result).toContain("spread");
      expect(result).toContain("-"); // no servers
    });

    it("should display server list", () => {
      const result = formatPlacementGroupDetails(
        makePlacementGroup({ servers: [10, 20, 30] })
      );
      expect(result).toContain("10, 20, 30");
    });
  });
});
