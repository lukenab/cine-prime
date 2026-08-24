import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PromotionWorkflowDialog } from "./PromotionWorkflowDialog";

const promotion = { name: "Opening offer", code: "OPEN20", activeReservationCount: 3 };

describe("PromotionWorkflowDialog", () => {
  it("requires an audit reason before pausing a live promotion", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PromotionWorkflowDialog action="pause" promotion={promotion} onConfirm={onConfirm} onCancel={vi.fn()} />);

    const confirm = screen.getByRole("button", { name: "Pause promotion" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/3 active reservation/)).toBeVisible();

    await user.type(screen.getByPlaceholderText("Provide a clear business reason..."), "Campaign configuration is incorrect");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Campaign configuration is incorrect");
  });

  it("explains that archive retains evidence and cannot be reversed", () => {
    render(<PromotionWorkflowDialog action="archive" promotion={promotion} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/cannot be reactivated/i)).toBeVisible();
    expect(screen.getByText(/audit evidence/i)).toBeVisible();
  });
});
