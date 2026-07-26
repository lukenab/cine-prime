import type { OptimizationScenario, OptimizerMode } from "../../../api/showtimeApi";

export const OPTIMIZER_META: Record<OptimizerMode, { label: string; description: string }> = {
  LEGACY: { label: "Legacy (greedy)", description: "Round-robin minimum coverage then fill by score, one day at a time. Fast, well-tested default." },
  CP_SAT: { label: "CP-SAT (weekly optimizer)", description: "Solves the whole date range jointly with Google OR-Tools. Can beat the greedy algorithm on weekly coverage trade-offs; falls back to Legacy automatically on solver error." },
  SHADOW_COMPARE: { label: "Shadow compare", description: "Runs both algorithms on the same input. Legacy's result is what actually gets used; CP-SAT's result is attached only for comparison." },
};

export const SCENARIO_META: Record<OptimizationScenario, { label: string; description: string }> = {
  CONSERVATIVE: { label: "Conservative", description: "Tighter room-share, fewer risky sessions, high stability." },
  BALANCED: { label: "Balanced", description: "Balanced utilization, demand satisfaction and diversity." },
  REVENUE_FOCUSED: { label: "Revenue-focused", description: "Prioritizes expected occupancy/revenue and prime-time allocation." },
};

export const SOLVER_STATUS_META: Record<string, { label: string; color: string; background: string }> = {
  OPTIMAL: { label: "Optimal", color: "#059669", background: "rgba(5,150,105,.12)" },
  FEASIBLE: { label: "Feasible", color: "#2563eb", background: "rgba(37,99,235,.12)" },
  INFEASIBLE: { label: "Infeasible", color: "#dc2626", background: "rgba(220,38,38,.12)" },
  MODEL_INVALID: { label: "Model invalid", color: "#dc2626", background: "rgba(220,38,38,.12)" },
  UNKNOWN: { label: "Timed out / unknown", color: "#d97706", background: "rgba(217,119,6,.12)" },
};
