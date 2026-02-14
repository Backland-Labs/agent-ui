import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("merges multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
    expect(cn("base", true && "visible", "extra")).toBe("base visible extra");
  });

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "extra")).toBe("base extra");
  });

  it("deduplicates conflicting tailwind classes", () => {
    // twMerge resolves conflicts: last one wins
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("merges tailwind classes without conflict", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("handles array inputs via clsx", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles object syntax via clsx", () => {
    expect(cn({ hidden: true, visible: false })).toBe("hidden");
    expect(cn({ hidden: false, visible: true })).toBe("visible");
  });
});
