import { expect, it } from "vitest";
import { explainSequence } from "../src/index.js";

it("explains a whitespace-padded ex write command as write file", () => {
  const result = explainSequence(": w [Enter]");
  expect(result.commands[0]?.explanation).toBe("write file");
});
