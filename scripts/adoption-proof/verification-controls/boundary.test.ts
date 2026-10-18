import { describe, expect, it } from "vitest";
import { Address } from "@shared/value-objects/address";

describe("Address length limit", () => {
  it("accepts exactly 500 characters after trimming", () => {
    const address = "a".repeat(500);

    expect(new Address(`  ${address}  `).getValue()).toBe(address);
  });

  it("rejects an address with 501 normalized characters", () => {
    expect(() => new Address("a".repeat(501))).toThrow("Invalid address");
  });
});
