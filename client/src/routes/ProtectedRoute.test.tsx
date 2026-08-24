import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/admin/my-workforce"]}>
      <Routes>
        <Route path="/" element={<div>Public home</div>} />
        <Route element={<ProtectedRoute allowedPermissions={["WORKFORCE_SELF_READ"]} />}>
          <Route path="/admin/my-workforce" element={<div>Self-service workforce</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute permission enforcement", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("accessToken", "test-token");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("does not let a legacy administrator bypass a missing permission", () => {
    localStorage.setItem("role", "ROLE_ADMIN");
    localStorage.setItem("roles", JSON.stringify(["ROLE_ADMIN"]));
    localStorage.setItem("permissions", JSON.stringify(["ROLE_MANAGE"]));
    renderProtected();
    expect(screen.getByText("Public home")).toBeInTheDocument();
  });

  it("allows an assigned staff persona with the required permission", () => {
    localStorage.setItem("role", "ROLE_BRANCH_MANAGER");
    localStorage.setItem("roles", JSON.stringify(["ROLE_BRANCH_MANAGER"]));
    localStorage.setItem("permissions", JSON.stringify(["WORKFORCE_SELF_READ"]));
    renderProtected();
    expect(screen.getByText("Self-service workforce")).toBeInTheDocument();
  });
});
