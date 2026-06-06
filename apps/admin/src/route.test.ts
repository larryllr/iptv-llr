import { describe, expect, it } from "vitest";
import { resolvePage } from "./route";

describe("public and administration routes", () => {
  it("opens the public player at the site root", () => {
    expect(resolvePage("/")).toBe("player");
  });

  it("opens administration only under /admin", () => {
    expect(resolvePage("/admin")).toBe("admin");
    expect(resolvePage("/admin/channels")).toBe("admin");
  });
});
