import { describe, expect, it } from "vitest";
import { clustersForSession } from "./clusterScope";

const clusters = [{ clusterId: 3 }, { clusterId: 43 }];

describe("clustersForSession", () => {
  it("limits employee and branch-manager sessions to signed cluster claims", () => {
    expect(clustersForSession(clusters, ["ROLE_EMPLOYEE"], ["43"]))
      .toEqual([{ clusterId: 43 }]);
    expect(clustersForSession(clusters, ["ROLE_BRANCH_MANAGER"], []))
      .toEqual([]);
  });

  it("keeps global administration scopes unchanged", () => {
    expect(clustersForSession(clusters, ["ROLE_ADMIN"], [])).toEqual(clusters);
  });
});
