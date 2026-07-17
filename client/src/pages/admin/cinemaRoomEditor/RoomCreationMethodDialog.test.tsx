import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoomCreationMethodDialog } from "./RoomCreationMethodDialog";

const rooms = [
  { cinemaRoomId: 7, cinemaRoomName: "Premium Hall", roomCode: "R07" },
  { cinemaRoomId: 8, cinemaRoomName: "Luxury Hall", roomCode: "R08" },
] as any;

describe("RoomCreationMethodDialog", () => {
  it("portals into the active admin theme so light/dark variables remain available", () => {
    const themeRoot = document.createElement("div");
    themeRoot.className = "theme-dark";
    document.body.appendChild(themeRoot);

    render(<RoomCreationMethodDialog rooms={rooms} onCreateNew={vi.fn()} onDuplicate={vi.fn()} onClose={vi.fn()} />);

    expect(themeRoot).toContainElement(screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle({ color: "var(--text-main)" });
    expect(dialog.getAttribute("style")).toContain("--modal-surface");
    expect(dialog.getAttribute("style")).toContain("--modal-border");
    themeRoot.remove();
  });

  it("continues directly into a new room by default", async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();
    render(<RoomCreationMethodDialog rooms={rooms} onCreateNew={onCreateNew} onDuplicate={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it("requires a source room before starting the duplicate flow", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(<RoomCreationMethodDialog rooms={rooms} onCreateNew={vi.fn()} onDuplicate={onDuplicate} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /duplicate existing room/i }));
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox"), "8");
    await user.click(continueButton);
    expect(onDuplicate).toHaveBeenCalledWith(8);
  });
});
