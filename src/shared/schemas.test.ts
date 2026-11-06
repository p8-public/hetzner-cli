import { describe, expect, it } from "vitest";
import { outputSchemas } from "./schemas.js";

const OUTPUT_TYPE_ARRAY_REGEX = /type Output = .+\[\];/;

describe("outputSchemas", () => {
  it("has the expected number of entries", () => {
    expect(Object.keys(outputSchemas).length).toBe(69);
  });

  it('every entry contains a "type Output" declaration', () => {
    for (const [path, schema] of Object.entries(outputSchemas)) {
      expect(schema, `schema for "${path}" missing type Output`).toContain(
        "type Output"
      );
    }
  });

  it("every entry is non-empty", () => {
    for (const [path, schema] of Object.entries(outputSchemas)) {
      expect(
        schema.trim().length,
        `schema for "${path}" is empty`
      ).toBeGreaterThan(0);
    }
  });

  describe("robot command paths are present", () => {
    const robotPaths = [
      "server list",
      "server get",
      "reset options",
      "boot status",
      "boot rescue last",
      "boot linux options",
      "ip list",
      "ip get",
      "ip mac get",
      "subnet list",
      "subnet get",
      "failover list",
      "failover get",
      "rdns list",
      "rdns get",
      "key list",
      "key get",
      "firewall get",
      "firewall template list",
      "firewall template get",
      "vswitch list",
      "vswitch get",
      "vswitch servers",
      "storagebox list",
      "storagebox get",
      "storagebox snapshot list",
      "storagebox subaccount list",
      "traffic query",
      "wol status",
      "cancel status",
      "order products",
      "order market",
      "order transactions",
      "order transaction",
    ];

    for (const path of robotPaths) {
      it(`has "${path}"`, () => {
        expect(outputSchemas[path]).toBeDefined();
      });
    }
  });

  describe("cloud command paths are present", () => {
    const cloudPaths = [
      "cloud server list",
      "cloud server describe",
      "cloud image list",
      "cloud image describe",
      "cloud volume list",
      "cloud volume describe",
      "cloud network list",
      "cloud network describe",
      "cloud firewall list",
      "cloud firewall describe",
      "cloud floating-ip list",
      "cloud floating-ip describe",
      "cloud primary-ip list",
      "cloud primary-ip describe",
      "cloud ssh-key list",
      "cloud ssh-key describe",
      "cloud certificate list",
      "cloud certificate describe",
      "cloud load-balancer list",
      "cloud load-balancer describe",
      "cloud placement-group list",
      "cloud placement-group describe",
      "cloud datacenter list",
      "cloud datacenter describe",
      "cloud location list",
      "cloud location describe",
      "cloud server-type list",
      "cloud server-type describe",
      "cloud load-balancer-type list",
      "cloud load-balancer-type describe",
      "cloud iso list",
      "cloud iso describe",
    ];

    for (const path of cloudPaths) {
      it(`has "${path}"`, () => {
        expect(outputSchemas[path]).toBeDefined();
      });
    }
  });

  describe("auction command paths are present", () => {
    it('has "auction list"', () => {
      expect(outputSchemas["auction list"]).toBeDefined();
    });

    it('has "auction show"', () => {
      expect(outputSchemas["auction show"]).toBeDefined();
    });

    it('has "auction status"', () => {
      expect(outputSchemas["auction status"]).toBeDefined();
    });
  });

  it("list schemas output arrays", () => {
    const listPaths = Object.keys(outputSchemas).filter((p) =>
      p.endsWith(" list")
    );
    for (const path of listPaths) {
      expect(outputSchemas[path], `"${path}" should output an array`).toMatch(
        OUTPUT_TYPE_ARRAY_REGEX
      );
    }
  });
});
