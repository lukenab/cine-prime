import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestState } from "./RequestState";

describe("RequestState", () => {
  it("uses a neutral status for an empty result", () => {
    render(<RequestState kind="empty" title="No approvals" />);
    expect(screen.getByRole("status")).toHaveTextContent("No approvals");
  });

  it("exposes a retry action for recoverable failures", () => {
    const retry = vi.fn();
    render(<RequestState kind="unavailable" onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
