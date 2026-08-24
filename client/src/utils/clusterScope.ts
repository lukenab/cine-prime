export interface ClusterWithId {
  clusterId: number;
}

const BRANCH_SCOPED_ROLES = new Set(["ROLE_EMPLOYEE", "ROLE_BRANCH_MANAGER"]);

/**
 * The signed JWT is the only authority for branch-scoped staff. UI filtering
 * improves usability, while each resource service still enforces the same
 * cluster scope server-side.
 */
export function clustersForSession<T extends ClusterWithId>(
  clusters: T[],
  roles: string[] = [],
  clusterIds: string[] = [],
): T[] {
  if (!roles.some((role) => BRANCH_SCOPED_ROLES.has(role))) {
    return clusters;
  }
  const allowed = new Set(clusterIds.map(String));
  return clusters.filter((cluster) => allowed.has(String(cluster.clusterId)));
}

