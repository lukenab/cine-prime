import { describe, expect, it } from "vitest";

import type { MovieAvailabilityResponse } from "../../api/movieApi";
import { groupReleasePlansByMovie } from "./ProgrammingApprovalWorkspacePage";

function plan(overrides: Partial<MovieAvailabilityResponse>): MovieAvailabilityResponse {
  return {
    availabilityId: 1,
    movieId: 10,
    movieTitle: "Example movie",
    clusterId: 100,
    clusterName: "Example cinema",
    status: "IN_REVIEW",
    showingStartDate: "2026-08-25",
    ...overrides,
  };
}

describe("groupReleasePlansByMovie", () => {
  it("groups branch plans by movie and keeps the oldest submission first", () => {
    const groups = groupReleasePlansByMovie([
      plan({ availabilityId: 1, movieId: 10, clusterId: 100, submittedAt: "2026-08-24T10:00:00Z" }),
      plan({ availabilityId: 2, movieId: 10, clusterId: 101, submittedAt: "2026-08-23T10:00:00Z" }),
      plan({ availabilityId: 3, movieId: 20, movieTitle: "Second movie", clusterId: 100, submittedAt: "2026-08-22T10:00:00Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ movieId: 20, planCount: 1, clusterCount: 1 });
    expect(groups[1]).toMatchObject({
      movieId: 10,
      planCount: 2,
      clusterCount: 2,
      submittedAt: "2026-08-23T10:00:00Z",
    });
  });

  it("does not double-count the same cluster", () => {
    const [group] = groupReleasePlansByMovie([
      plan({ availabilityId: 1, clusterId: 100 }),
      plan({ availabilityId: 2, clusterId: 100 }),
    ]);

    expect(group).toMatchObject({ planCount: 2, clusterCount: 1 });
  });
});
