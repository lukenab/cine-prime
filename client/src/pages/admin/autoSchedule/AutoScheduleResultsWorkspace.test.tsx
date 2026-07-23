import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AutoShowtimeGenerationRunResponse, SchedulePlanResponse } from "../../../api/showtimeApi";
import AutoScheduleResultsWorkspace from "./AutoScheduleResultsWorkspace";

const run: AutoShowtimeGenerationRunResponse = {
  generationRunId: 6,
  status: "COMPLETED",
  schedulePlanId: 10,
  startDate: "2026-07-27",
  endDate: "2026-07-31",
  summary: {
    candidateCount: 24,
    createdCount: 2,
    skippedCount: 22,
    successfulPartitionCount: 5,
    failedPartitionCount: 0,
  },
  movieResults: [{ movieId: 1, movieTitle: "Test Movie", demandTier: "NORMAL", candidateCount: 24, createdCount: 2, skippedCount: 22 }],
  showtimes: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
};

const plan: SchedulePlanResponse = {
  schedulePlanId: 10,
  generationRunId: 6,
  status: "IN_REVIEW",
  blockerCount: 0,
  slots: [
    {
      schedulePlanSlotId: 101,
      movieId: 1,
      movieTitle: "Test Movie",
      moviePosterUrl: "https://images.example/test-movie-poster.jpg",
      clusterId: 2,
      clusterName: "CinePrime Test",
      cinemaRoomId: 3,
      cinemaRoomName: "Room 1",
      screeningVersionId: 1,
      formatCode: "2D",
      audioLanguageCode: "vi",
      businessDate: "2026-07-27",
      startAt: "2026-07-27T18:00:00+07:00",
      endAt: "2026-07-27T20:00:00+07:00",
      totalSeats: 100,
      scoreBreakdown: {
        allocationScore: 0.82,
        daypart: "EVENING",
        capacityFitScore: 0.9,
        expectedAttendance: 80,
        roomCapacity: 100,
      },
    },
    {
      schedulePlanSlotId: 102,
      movieId: 1,
      movieTitle: "Test Movie",
      moviePosterUrl: "https://images.example/test-movie-poster.jpg",
      clusterId: 2,
      clusterName: "CinePrime Test",
      cinemaRoomId: 3,
      cinemaRoomName: "Room 1",
      screeningVersionId: 1,
      formatCode: "2D",
      audioLanguageCode: "vi",
      businessDate: "2026-07-27",
      startAt: "2026-07-27T19:30:00+07:00",
      endAt: "2026-07-27T21:30:00+07:00",
    },
  ],
};

describe("AutoScheduleResultsWorkspace", () => {
  it("defaults to the schedule board and keeps room utilization as a secondary view", async () => {
    const user = userEvent.setup();
    render(<AutoScheduleResultsWorkspace run={run} plan={plan} busy={false} error={null} onNewRun={vi.fn()} onTransition={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Cinema schedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule board" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "CinePrime Test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Room 1" })).toBeInTheDocument();
    expect(screen.getByText(`18:00 ${"\u2013"} 20:00`)).toBeInTheDocument();
    expect(screen.getByText("30m overlap")).toBeInTheDocument();
    expect(screen.getByText("80/100 seats")).toBeInTheDocument();
    expect(screen.getAllByAltText("Test Movie poster")).toHaveLength(2);

    const cinemaAccordion = screen.getByRole("button", { name: /CinePrime Test/i });
    expect(cinemaAccordion).toHaveAttribute("aria-expanded", "true");
    await user.click(cinemaAccordion);
    expect(screen.queryByRole("heading", { name: "Room 1" })).not.toBeInTheDocument();
    await user.click(cinemaAccordion);
    expect(screen.getByRole("heading", { name: "Room 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^review 1$/i }));
    expect(screen.getByRole("dialog", { name: "Schedule review" })).toBeInTheDocument();
    expect(screen.getByText("Room overlaps").parentElement).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Close issues modal" }));

    await user.click(screen.getByRole("button", { name: /allocation/i }));
    expect(screen.getByRole("dialog", { name: "Movie allocation" })).toBeInTheDocument();
    expect(screen.getByText("80/100")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Movie allocation" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /publish schedule/i })).toBeDisabled();
    expect(screen.getByText("Candidate slots evaluated")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Room utilization" }));
    expect(screen.getByRole("heading", { name: "Room utilization" })).toBeInTheDocument();
    expect(screen.getByTitle(/Forecast: 80\/100 seats/)).toBeInTheDocument();
  });

  it("uses a read-only action state after the plan is published", () => {
    render(<AutoScheduleResultsWorkspace run={run} plan={{ ...plan, status: "PUBLISHED" }} busy={false} error={null} onNewRun={vi.fn()} onTransition={vi.fn()} />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it("presents backend validation as a business issue while keeping raw details secondary", async () => {
    const user = userEvent.setup();
    const rawIssue = "MAXIMUM_CONCURRENT_ROOM_SHARE: movie=1 cluster=2 date=2026-07-27 max=1 actual=2";
    render(
      <AutoScheduleResultsWorkspace
        run={run}
        plan={{ ...plan, blockerCount: 1, validationSummary: rawIssue }}
        busy={false}
        error={null}
        onNewRun={vi.fn()}
        onTransition={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^review 2$/i }));
    expect(screen.getByRole("dialog", { name: "Schedule review" })).toBeInTheDocument();
    expect(screen.getByText("Too many rooms assigned to Test Movie")).toBeInTheDocument();
    expect(screen.getByText(/scheduled in 2 rooms at the same time at CinePrime Test/i)).toBeInTheDocument();
    expect(screen.getByText(/Move or remove at least 1 overlapping session/i)).toBeInTheDocument();

    const technicalDetails = screen.getByText("Technical details");
    expect(screen.getByText(rawIssue)).not.toBeVisible();
    await user.click(technicalDetails);
    expect(screen.getByText(rawIssue)).toBeVisible();
  });
});
