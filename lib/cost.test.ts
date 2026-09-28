import { describe, expect, it, vi } from "vitest";

// lib/cost imports auth/prisma (server-only); stub them so the pure role
// helper can be unit tested without a DB or session.
vi.mock("./auth", () => ({ auth: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {} }));

import { canViewVendorCost, stripCost } from "./cost";

describe("canViewVendorCost (company policy helper)", () => {
  it("allows admins and blocks staff", () => {
    expect(canViewVendorCost("HEAD_ADMIN")).toBe(true);
    expect(canViewVendorCost("BRANCH_ADMIN")).toBe(true);
    expect(canViewVendorCost("STAFF")).toBe(false);
    expect(canViewVendorCost(null)).toBe(false);
    expect(canViewVendorCost(undefined)).toBe(false);
  });
});

describe("stripCost", () => {
  it("removes unitPrice at any depth and returns a copy", () => {
    const row = { itemName: "AHU", unitPrice: "12345.00", vendor: { id: "v1" } };
    const out = stripCost(row);
    expect(out).not.toHaveProperty("unitPrice");
    expect(out.itemName).toBe("AHU");
    expect(row).toHaveProperty("unitPrice"); // original untouched
  });

  it("leaves other fields (sellPrice etc.) intact", () => {
    const rows = [
      { itemName: "A", unitPrice: 10, sellPrice: 20 },
      { itemName: "B", sellPrice: 30 },
    ];
    const out = stripCost(rows);
    expect(out[0]).toEqual({ itemName: "A", sellPrice: 20 });
    expect(out[1]).toEqual({ itemName: "B", sellPrice: 30 });
  });
});
