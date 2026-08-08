import axiosClient from "./api";

export interface MembershipSummary {
  membershipId: string;
  accountId: string;
  membershipLevel: "MEMBER" | "SILVER" | "GOLD" | "PLATINUM";
  status: "ACTIVE" | "SUSPENDED";
  availablePoints: number;
  pendingPoints: number;
  lifetimeSpend: number;
  joinedAt: string;
  nextLevel: string | null;
  nextLevelSpendThreshold: number;
  progressPercent: number;
}

const unwrap = <T>(response: unknown): T => {
  const body = response as { result?: T } | T;
  return (body && typeof body === "object" && "result" in body && body.result ? body.result : body) as T;
};

export const loyaltyApi = {
  getMyMembership: async (): Promise<MembershipSummary> => {
    const response = await axiosClient.get("/api/membership/me");
    return unwrap<MembershipSummary>(response);
  },
};
