import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Archive, Eye, Pencil, Send, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowActions } from "./RowActions";

describe("RowActions", () => {
  it("shows up to three actions as direct icon buttons", async () => {
    const user = userEvent.setup();
    const view = vi.fn();
    const remove = vi.fn();

    render(
      <RowActions
        ariaLabel="Actions for Spring campaign"
        actions={[
          { key: "view", label: "View details", icon: Eye, onSelect: view },
          { key: "delete", label: "Delete", icon: Trash2, onSelect: remove, destructive: true, separatorBefore: true },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Actions for Spring campaign" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(view).toHaveBeenCalledOnce();
  });

  it("moves four or more actions into the overflow menu", async () => {
    const user = userEvent.setup();
    const view = vi.fn();

    render(
      <RowActions
        ariaLabel="Actions for Spring campaign"
        actions={[
          { key: "view", label: "View details", icon: Eye, onSelect: view },
          { key: "edit", label: "Edit", icon: Pencil, onSelect: vi.fn() },
          { key: "submit", label: "Submit", icon: Send, onSelect: vi.fn() },
          { key: "archive", label: "Archive", icon: Archive, onSelect: vi.fn(), destructive: true, separatorBefore: true },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Spring campaign" }));
    await user.click(screen.getByRole("menuitem", { name: "View details" }));
    expect(view).toHaveBeenCalledOnce();
  });

  it("supports one explicit primary action for an operational queue", async () => {
    const user = userEvent.setup();
    const review = vi.fn();

    render(
      <RowActions
        ariaLabel="More actions"
        primaryAction={{ key: "review", label: "Review", icon: Eye, onSelect: review }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(review).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });
});
