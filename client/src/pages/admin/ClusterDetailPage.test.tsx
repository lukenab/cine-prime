import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClusterResponse } from "../../api/movieApi";
import ClusterDetailPage from "./ClusterDetailPage";

const mocks = vi.hoisted(() => ({
  getClusterById: vi.fn(),
  getRoomsByCluster: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ id: "11" }),
    useNavigate: () => mocks.navigate,
    useOutletContext: () => ({ isDarkMode: false }),
  };
});

vi.mock("../../api/movieApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/movieApi")>();
  return {
    ...actual,
    movieApi: {
      ...actual.movieApi,
      getClusterById: mocks.getClusterById,
      getRoomsByCluster: mocks.getRoomsByCluster,
    },
  };
});

vi.mock("../../hooks/useRole", () => ({
  useRole: () => ({
    can: { submit: true, edit: true },
    isAdmin: true,
    username: "admin",
  }),
}));

vi.mock("./ClusterWizardModal", () => ({ ClusterWizardModal: () => null }));
vi.mock("./cinemaRoomEditor/RoomCreationMethodDialog", () => ({ RoomCreationMethodDialog: () => null }));
vi.mock("../../components/shared/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

const cluster: ClusterResponse = {
  clusterId: 11,
  clusterCode: "CP-Q1",
  clusterName: "CinePrime Quận 1",
  venueType: "MALL",
  countryCode: "VN",
  province: "TP. Hồ Chí Minh",
  address: "182 Tăng Nhơn Phú",
  timezone: "Asia/Ho_Chi_Minh",
  operatingHours: [],
  status: "ACTIVE",
  totalRooms: 7,
  totalSeats: 600,
};

describe("ClusterDetailPage room resource states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClusterById.mockResolvedValue({ result: cluster });
  });

  it("keeps the cluster visible and shows a room error instead of an empty state", async () => {
    mocks.getRoomsByCluster.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          message: "Room service unavailable",
          correlationId: "corr-room-503",
        },
      },
    });

    render(<ClusterDetailPage />);

    expect(await screen.findByRole("heading", { name: "CinePrime Quận 1" })).toBeInTheDocument();
    expect(await screen.findByText("Failed to load rooms")).toBeInTheDocument();
    expect(screen.getByText("Room service unavailable")).toBeInTheDocument();
    expect(screen.getByText("corr-room-503")).toBeInTheDocument();
    expect(screen.queryByText(/No rooms in this cluster/i)).not.toBeInTheDocument();
  });

  it("retries only the failed room resource and shows empty state after a successful empty response", async () => {
    mocks.getRoomsByCluster
      .mockRejectedValueOnce({ response: { status: 500, data: { message: "Temporary failure" } } })
      .mockResolvedValueOnce({ result: [] });

    render(<ClusterDetailPage />);

    const errorState = await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(errorState).not.toBeInTheDocument());
    expect(await screen.findByText(/No rooms in this cluster yet/i)).toBeInTheDocument();
    expect(mocks.getClusterById).toHaveBeenCalledTimes(1);
    expect(mocks.getRoomsByCluster).toHaveBeenCalledTimes(2);
  });
});
