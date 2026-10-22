import { describe, expect, it } from "vitest";
import { Address } from "@shared/value-objects/address";

describe("Address normalized length boundary", () => {
  it("accepts exactly 500 characters after trimming", () => {
    expect(() => new Address(`  ${"a".repeat(500)}  `)).not.toThrow();
  });

  it("rejects 501 normalized characters", () => {
    expect(() => new Address("a".repeat(501))).toThrow("Invalid address");
  });
});
