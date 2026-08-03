import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("../../api/authApi", () => ({
  authApi: mocks,
}));

describe("password recovery pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.forgotPassword.mockResolvedValue({ code: 1000 });
    mocks.resetPassword.mockResolvedValue({ code: 1000 });
  });

  it("shows the same generic confirmation after requesting a reset", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

    await user.type(screen.getByRole("textbox", { name: "Email address" }), "member@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(mocks.forgotPassword).toHaveBeenCalledWith("member@example.com");
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/If an active CinePrime account exists/)).toBeInTheDocument();
  });

  it("validates confirmation before calling the reset API", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password?token=one-time-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("New password"), "ValidPass1");
    await user.type(screen.getByLabelText("Confirm password"), "Different1");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("submits a valid one-time token and password", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password?token=one-time-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("New password"), "ValidPass1");
    await user.type(screen.getByLabelText("Confirm password"), "ValidPass1");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(mocks.resetPassword).toHaveBeenCalledWith({
      token: "one-time-token",
      newPassword: "ValidPass1",
    });
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });
});
