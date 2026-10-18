import { describe, expect, it } from "vitest";
import { Address } from "@shared/value-objects/address";

describe("Address empty-only control", () => {
  it("rejects an empty normalized address", () => {
    expect(() => new Address("   ")).toThrow("Invalid address");
  });
});
