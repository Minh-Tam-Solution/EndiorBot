/**
 * Text Helpers Tests
 *
 * @module tests/utils/text-helpers
 */

import { describe, it, expect } from "vitest";
import { truncate, padEndTruncate } from "../../src/utils/text-helpers.js";

describe("truncate", () => {
  it("returns the original string when within max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the original string when equal to max length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("returns only ellipsis when max length is 3", () => {
    expect(truncate("hello", 3)).toBe("...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("padEndTruncate", () => {
  it("pads shorter strings with spaces", () => {
    expect(padEndTruncate("ID", 5)).toBe("ID   ");
  });

  it("truncates strings longer than width", () => {
    expect(padEndTruncate("identifier", 5)).toBe("ident");
  });

  it("returns original string when width matches", () => {
    expect(padEndTruncate("hello", 5)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(padEndTruncate("", 3)).toBe("   ");
  });
});
