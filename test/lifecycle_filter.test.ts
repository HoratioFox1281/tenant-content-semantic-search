import { describe, expect, it } from "vitest";
import { activeTenantFilter } from "../src/infrai_search.js";

describe("tenant content visibility", () => {
  it("keeps archived and cross-tenant documents out of admin search", () => {
    expect(activeTenantFilter("acme-media", "admin_operations")).toEqual({
      tenant_id: "acme-media",
      lifecycle: "active",
      area: "admin_operations",
    });
  });
});
