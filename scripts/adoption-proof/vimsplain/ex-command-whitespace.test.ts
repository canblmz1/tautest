import { expect, it } from "vitest";
import { explainSequence } from "../src/index.js";

it("recognizes a write command with surrounding whitespace", () => {
  expect(explainSequence(": w [Enter]")).toEqual({
    commands: [{ matched: ": w ", explanation: "write file" }],
    remaining: "",
  });
});

it("continues with a normal command after the ex command terminator", () => {
  expect(explainSequence(":w[Enter]dd")).toEqual({
    commands: [
      { matched: ":w", explanation: "write file" },
      { matched: "dd", explanation: "delete line" },
    ],
    remaining: "",
  });
});
