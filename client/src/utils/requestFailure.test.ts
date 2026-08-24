import { describe, expect, it } from "vitest";
import { classifyRequestFailure } from "./requestFailure";

describe("classifyRequestFailure", () => {
  it("distinguishes authorization failures from service failures", () => {
    expect(classifyRequestFailure({ response: { status: 403 } }).kind).toBe("forbidden");
    expect(classifyRequestFailure({ response: { status: 503 } }).kind).toBe("unavailable");
  });

  it("treats network failures as temporary unavailability", () => {
    expect(classifyRequestFailure(new Error("Network Error")).kind).toBe("unavailable");
  });

  it("preserves a backend validation message for ordinary request errors", () => {
    const result = classifyRequestFailure({ response: { status: 400, data: { message: "Invalid planning window" } } });
    expect(result.kind).toBe("error");
    expect(result.description).toBe("Invalid planning window");
  });
});
