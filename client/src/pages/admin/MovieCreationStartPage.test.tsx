import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MovieCreationStartPage from "./MovieCreationStartPage";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

describe("MovieCreationStartPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes catalog and manual creation through separate entry points", () => {
    render(<MovieCreationStartPage />);

    fireEvent.click(screen.getByRole("button", { name: /Import from catalog/i }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/admin/movies/new/catalog");

    fireEvent.click(screen.getByRole("button", { name: /Create manually/i }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/admin/movies/new/manual");
  });
});
