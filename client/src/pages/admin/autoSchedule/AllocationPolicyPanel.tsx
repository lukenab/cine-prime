import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Gauge,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  showtimeApi,
  type ShowtimeAllocationPolicy,
  type ShowtimeAllocationPolicyPayload,
  type ShowtimeDaypart,
  type ShowtimeDaypartPolicy,
} from "../../../api/showtimeApi";
import { movieApi, type ScreeningFormatResponse } from "../../../api/movieApi";
import { OPTIMIZER_META } from "./optimizerMeta";

const DEFAULT_POLICY_CODE = "DEFAULT";

type StrategyKey = "CONSERVATIVE" | "BALANCED" | "REVENUE_FOCUSED" | "CUSTOM";
type NumericKey =
  | "movieDemandWeight"
  | "clusterDemandWeight"
  | "timeSlotDemandWeight"
  | "formatDemandWeight"
  | "roomCapacityWeight";

const STRATEGIES: Record<Exclude<StrategyKey, "CUSTOM">, {
  label: string;
  description: string;
  accent: string;
  weights: Record<NumericKey, number>;
}> = {
  CONSERVATIVE: {
    label: "Conservative",
    description: "Protect coverage and capacity fit before adding aggressive prime-time sessions.",
    accent: "#0f766e",
    weights: {
      movieDemandWeight: 0.2,
      clusterDemandWeight: 0.2,
      timeSlotDemandWeight: 0.2,
      formatDemandWeight: 0.1,
      roomCapacityWeight: 0.3,
    },
  },
  BALANCED: {
    label: "Balanced",
    description: "Balance audience demand, local cinema demand, time slots and room utilization.",
    accent: "#2563eb",
    weights: {
      movieDemandWeight: 0.3,
      clusterDemandWeight: 0.2,
      timeSlotDemandWeight: 0.2,
      formatDemandWeight: 0.15,
      roomCapacityWeight: 0.15,
    },
  },
  REVENUE_FOCUSED: {
    label: "Revenue-focused",
    description: "Prioritize forecast demand and prime-time allocation. This is a demand proxy, not a revenue forecast.",
    accent: "#7c3aed",
    weights: {
      movieDemandWeight: 0.4,
      clusterDemandWeight: 0.15,
      timeSlotDemandWeight: 0.25,
      formatDemandWeight: 0.1,
      roomCapacityWeight: 0.1,
    },
  },
};

const DAYPART_OPTIONS: ShowtimeDaypart[] = ["MORNING", "AFTERNOON", "EVENING", "LATE_NIGHT"];
const DAYPART_LABELS: Record<ShowtimeDaypart, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  LATE_NIGHT: "Late night",
};

function defaultDayparts(): ShowtimeDaypartPolicy[] {
  return [
    { daypartCode: "MORNING", startTime: "09:00:00", endTime: "12:00:00", weekdayDemandMultiplier: 0.7, weekendDemandMultiplier: 0.8, active: true },
    { daypartCode: "AFTERNOON", startTime: "12:00:00", endTime: "17:00:00", weekdayDemandMultiplier: 0.9, weekendDemandMultiplier: 1, active: true },
    { daypartCode: "EVENING", startTime: "17:00:00", endTime: "22:00:00", weekdayDemandMultiplier: 1.15, weekendDemandMultiplier: 1.25, active: true },
    { daypartCode: "LATE_NIGHT", startTime: "22:00:00", endTime: "23:59:59", weekdayDemandMultiplier: 0.65, weekendDemandMultiplier: 0.8, active: true },
  ];
}

function emptyPayload(): ShowtimeAllocationPolicyPayload {
  return {
    policyCode: DEFAULT_POLICY_CODE,
    active: false,
    peakDemandWeight: 0.3,
    ...STRATEGIES.BALANCED.weights,
    minimumCoverage: 1,
    maximumRoomShare: 0.6,
    planningHorizonStartDays: 3,
    planningHorizonEndDays: 9,
    cleanupBufferMinutes: 15,
    timeSlotIntervalMinutes: 15,
    sameMovieStaggerMinutes: 20,
    maxSolveTimeSeconds: 30,
    solverRandomSeed: 42,
    solverSearchWorkers: 8,
    solverRelativeGap: 0,
    solverLogSearchProgress: false,
    maxCandidatesPerMoviePerDay: undefined,
    optimizerFallbackToLegacyOnError: true,
    defaultOptimizerMode: "CP_SAT",
    businessTimezone: "Asia/Ho_Chi_Minh",
    peakStartTime: "18:00:00",
    peakEndTime: "22:00:00",
    formatPriorities: [],
    daypartPolicies: defaultDayparts(),
  };
}

function toPayload(policy: ShowtimeAllocationPolicy): ShowtimeAllocationPolicyPayload {
  const { policyId, createdAt, updatedAt, createdBy, updatedBy, ...rest } = policy;
  return rest;
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}

function strategyFor(payload: ShowtimeAllocationPolicyPayload): StrategyKey {
  const match = Object.entries(STRATEGIES).find(([, strategy]) =>
    (Object.keys(strategy.weights) as NumericKey[])
      .every((key) => sameNumber(payload[key], strategy.weights[key])),
  );
  return (match?.[0] as StrategyKey | undefined) ?? "CUSTOM";
}

function fieldStyle(invalid?: boolean) {
  return {
    background: "var(--bg-main)",
    borderColor: invalid ? "#dc2626" : "var(--border-color)",
    color: "var(--text-main)",
  } as const;
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  right,
}: {
  icon: typeof Target;
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-blue-600" style={{ background: "rgba(37,99,235,.10)" }}>
            <Icon size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{title}</h3>
            {description && <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-sub)" }}>{description}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
  min,
  max,
  suffix,
  hint,
  invalid,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  step?: string;
  min?: string;
  max?: string;
  suffix?: string;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          className={`h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition focus:border-blue-500 ${suffix ? "pr-12" : ""}`}
          style={fieldStyle(invalid)}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs" style={{ color: "var(--text-sub)" }}>{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[11px] leading-4" style={{ color: invalid ? "#dc2626" : "var(--text-sub)" }}>{hint}</span>}
    </label>
  );
}

function timeLabel(value: string) {
  return value?.slice(0, 5) || "--:--";
}

function formatPriorityLabel(value?: number) {
  if (value == null) return "Not preferred";
  if (value >= 80) return "High";
  if (value >= 50) return "Normal";
  return "Low";
}

export default function AllocationPolicyPanel() {
  const [policies, setPolicies] = useState<ShowtimeAllocationPolicy[]>([]);
  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payload, setPayload] = useState<ShowtimeAllocationPolicyPayload>(emptyPayload());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [showDayparts, setShowDayparts] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([showtimeApi.listAllocationPolicies(), movieApi.getScreeningFormats()])
      .then(([policyResponse, formatResponse]) => {
        setPolicies(policyResponse.result ?? []);
        setFormats(formatResponse.result ?? []);
      })
      .catch(() => setError("Could not load scheduling policies."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selectedStrategy = useMemo(() => strategyFor(payload), [payload]);
  const scoreWeightTotal = useMemo(
    () => payload.movieDemandWeight
      + payload.clusterDemandWeight
      + payload.timeSlotDemandWeight
      + payload.formatDemandWeight
      + payload.roomCapacityWeight,
    [payload],
  );
  const activeDayparts = useMemo(
    () => (payload.daypartPolicies ?? []).filter((row) => row.active),
    [payload.daypartPolicies],
  );
  const preferredFormats = useMemo(
    () => (payload.formatPriorities ?? []).filter((item) => item.allocationPriority > 0),
    [payload.formatPriorities],
  );
  const priorityByFormat = useMemo(() => {
    const values = new Map<number, number>();
    (payload.formatPriorities ?? []).forEach((item) => values.set(item.formatId, item.allocationPriority));
    return values;
  }, [payload.formatPriorities]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const weights = [
      payload.movieDemandWeight,
      payload.clusterDemandWeight,
      payload.timeSlotDemandWeight,
      payload.formatDemandWeight,
      payload.roomCapacityWeight,
    ];

    if (!payload.policyCode.trim()) errors.push("Policy code is required.");
    if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) errors.push("Score weights cannot be negative.");
    if (scoreWeightTotal <= 0) errors.push("At least one scoring factor must be greater than zero.");
    if (!sameNumber(scoreWeightTotal, 1)) warnings.push(`Scoring factors total ${(scoreWeightTotal * 100).toFixed(0)}%. Presets normalize them to 100%.`);
    if (payload.maximumRoomShare <= 0 || payload.maximumRoomShare > 1) errors.push("Maximum concurrent screens must be between 1% and 100%.");
    if (payload.minimumCoverage < 0) errors.push("Minimum daily coverage cannot be negative.");
    if (payload.planningHorizonStartDays < 0 || payload.planningHorizonEndDays < payload.planningHorizonStartDays) {
      errors.push("Planning window end must be on or after its start.");
    }
    if (payload.cleanupBufferMinutes < 0 || payload.sameMovieStaggerMinutes < 0 || payload.timeSlotIntervalMinutes <= 0) {
      errors.push("Turnaround, stagger and slot interval values must be valid positive durations.");
    }
    if (!payload.businessTimezone.trim()) errors.push("Business timezone is required.");
    if ((payload.daypartPolicies ?? []).some((row) =>
      !row.startTime || !row.endTime || row.weekdayDemandMultiplier < 0 || row.weekendDemandMultiplier < 0)) {
      errors.push("Daypart times and demand multipliers must be valid.");
    }
    const daypartCodes = (payload.daypartPolicies ?? []).map((row) => row.daypartCode);
    if (new Set(daypartCodes).size !== daypartCodes.length) errors.push("Each daypart can only be configured once.");
    if (payload.defaultOptimizerMode === "LEGACY") warnings.push("Legacy mode does not use the CP-SAT solver settings.");
    if (activeDayparts.length === 0) warnings.push("No dayparts are active; the compatibility peak/off-peak rule will be used.");
    if (payload.policyCode !== DEFAULT_POLICY_CODE) warnings.push("Generation runs currently use only the active DEFAULT policy.");
    return { errors, warnings };
  }, [activeDayparts.length, payload, scoreWeightTotal]);

  const updateDaypart = (index: number, patch: Partial<ShowtimeDaypartPolicy>) => {
    setPayload((current) => {
      const rows = [...(current.daypartPolicies ?? [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...current, daypartPolicies: rows };
    });
  };

  const addDaypart = () => {
    setPayload((current) => {
      const used = new Set((current.daypartPolicies ?? []).map((row) => row.daypartCode));
      const nextCode = DAYPART_OPTIONS.find((code) => !used.has(code));
      if (!nextCode) return current;
      const row = defaultDayparts().find((item) => item.daypartCode === nextCode)!;
      return { ...current, daypartPolicies: [...(current.daypartPolicies ?? []), row] };
    });
  };

  const removeDaypart = (index: number) => {
    setPayload((current) => ({
      ...current,
      daypartPolicies: (current.daypartPolicies ?? []).filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const setFormatPriority = (formatId: number, value: string) => {
    const priority = value === "NONE" ? undefined : Number(value);
    setPayload((current) => {
      const otherPriorities = (current.formatPriorities ?? []).filter((item) => item.formatId !== formatId);
      return {
        ...current,
        formatPriorities: priority == null
          ? otherPriorities
          : [...otherPriorities, { formatId, allocationPriority: priority }],
      };
    });
  };

  const applyStrategy = (strategyKey: Exclude<StrategyKey, "CUSTOM">) => {
    setPayload((current) => ({ ...current, ...STRATEGIES[strategyKey].weights }));
  };

  const openCreate = () => {
    setEditingId(null);
    setPayload(emptyPayload());
    setSaveError(null);
    setShowDayparts(false);
    setShowFormats(false);
    setView("edit");
  };

  const openEdit = (policy: ShowtimeAllocationPolicy) => {
    setEditingId(policy.policyId);
    setPayload(toPayload(policy));
    setSaveError(null);
    setShowDayparts(false);
    setShowFormats(false);
    setView("edit");
  };

  const save = async () => {
    if (validation.errors.length > 0) {
      setSaveError("Resolve the validation issues before saving this policy.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId != null) {
        await showtimeApi.updateAllocationPolicy(editingId, payload);
      } else {
        await showtimeApi.createAllocationPolicy(payload);
      }
      setView("list");
      load();
    } catch (requestError: any) {
      setSaveError(requestError?.response?.data?.message ?? "Could not save this policy.");
    } finally {
      setSaving(false);
    }
  };

  const activate = async (policyId: number) => {
    setActivatingId(policyId);
    try {
      await showtimeApi.activateAllocationPolicy(policyId);
      load();
    } catch {
      setError("Could not activate this policy.");
    } finally {
      setActivatingId(null);
    }
  };

  if (view === "edit") {
    return (
      <div className="space-y-4 pb-24">
        <button
          type="button"
          onClick={() => setView("list")}
          className="flex items-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold"
          style={{ color: "var(--text-sub)" }}
        >
          <ChevronLeft size={14} /> Back to policies
        </button>

        <section className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl"
          style={{ borderColor: "var(--border-color)", background: "color-mix(in srgb, var(--bg-card) 94%, transparent)" }}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
                {editingId == null ? "New scheduling policy" : "Edit scheduling policy"}
              </h2>
              <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: payload.active ? "#059669" : "var(--text-sub)", background: payload.active ? "rgba(5,150,105,.12)" : "var(--bg-main)" }}>
                {payload.active ? "Active" : "Draft"}
              </span>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>
              Global default · {selectedStrategy === "CUSTOM" ? "Custom strategy" : STRATEGIES[selectedStrategy].label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setView("list")} className="rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving || validation.errors.length > 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save policy
            </button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="space-y-4">
            <SectionCard
              icon={Target}
              title="Scheduling strategy"
              description="Choose the business outcome. The scoring factors are configured automatically and remain available for expert review."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(STRATEGIES) as Array<Exclude<StrategyKey, "CUSTOM">>).map((key) => {
                  const strategy = STRATEGIES[key];
                  const selected = selectedStrategy === key;
                  return (
                    <button key={key} type="button" onClick={() => applyStrategy(key)}
                      className="relative rounded-2xl border p-4 text-left transition hover:-translate-y-0.5"
                      style={{
                        borderColor: selected ? strategy.accent : "var(--border-color)",
                        background: selected ? `color-mix(in srgb, ${strategy.accent} 10%, var(--bg-card))` : "var(--bg-main)",
                        boxShadow: selected ? `0 0 0 1px ${strategy.accent}` : "none",
                      }}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold" style={{ color: selected ? strategy.accent : "var(--text-main)" }}>{strategy.label}</span>
                        {selected && <CheckCircle2 size={16} style={{ color: strategy.accent }} />}
                      </div>
                      <p className="text-xs leading-5" style={{ color: "var(--text-sub)" }}>{strategy.description}</p>
                    </button>
                  );
                })}
              </div>
              {selectedStrategy === "CUSTOM" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs"
                  style={{ borderColor: "rgba(217,119,6,.28)", color: "var(--text-main)", background: "rgba(217,119,6,.07)" }}>
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  This policy uses custom scoring factors. Choose a preset to return to a normalized business strategy.
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={CalendarRange}
              title="Operational guardrails"
              description="Set the planning window and the limits the optimizer must respect."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField label="Plan from" value={payload.planningHorizonStartDays}
                  onChange={(value) => setPayload((current) => ({ ...current, planningHorizonStartDays: value }))}
                  min="0" suffix="D+" hint="Earliest business day included." />
                <NumberField label="Plan through" value={payload.planningHorizonEndDays}
                  onChange={(value) => setPayload((current) => ({ ...current, planningHorizonEndDays: value }))}
                  min="0" suffix="D+" hint="Latest business day included."
                  invalid={payload.planningHorizonEndDays < payload.planningHorizonStartDays} />
                <NumberField label="Minimum coverage per active day" value={payload.minimumCoverage}
                  onChange={(value) => setPayload((current) => ({ ...current, minimumCoverage: value }))}
                  min="0" suffix="shows" hint="Base floor per movie and cinema; CP-SAT applies it across the selected planning days." />
                <NumberField label="Maximum concurrent screens" value={Math.round(payload.maximumRoomShare * 100)}
                  onChange={(value) => setPayload((current) => ({ ...current, maximumRoomShare: value / 100 }))}
                  min="1" max="100" suffix="%" hint="Same movie at the same cinema." invalid={payload.maximumRoomShare <= 0 || payload.maximumRoomShare > 1} />
                <NumberField label="Turnaround buffer" value={payload.cleanupBufferMinutes}
                  onChange={(value) => setPayload((current) => ({ ...current, cleanupBufferMinutes: value }))}
                  min="0" suffix="min" hint="Cleaning and audience turnover." />
                <NumberField label="Same-movie start gap" value={payload.sameMovieStaggerMinutes}
                  onChange={(value) => setPayload((current) => ({ ...current, sameMovieStaggerMinutes: value }))}
                  min="0" suffix="min" hint="Across different rooms in one cinema." />
              </div>
            </SectionCard>

            <SectionCard
              icon={Clock3}
              title="Demand by time of day"
              description="Active bands adjust demand for weekdays and weekends. Keep the summary collapsed unless an override is needed."
              right={
                <button type="button" onClick={() => setShowDayparts((current) => !current)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                  {showDayparts ? "Done" : "Edit bands"} <ChevronDown size={13} className={`transition ${showDayparts ? "rotate-180" : ""}`} />
                </button>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {activeDayparts.map((row) => (
                  <div key={row.daypartPolicyId ?? row.daypartCode} className="rounded-xl border px-3 py-2.5"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                    <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>{DAYPART_LABELS[row.daypartCode]}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{timeLabel(row.startTime)}–{timeLabel(row.endTime)}</p>
                    <p className="mt-1 text-[10px]" style={{ color: "var(--text-sub)" }}>
                      Weekday ×{row.weekdayDemandMultiplier} · Weekend ×{row.weekendDemandMultiplier}
                    </p>
                  </div>
                ))}
                {activeDayparts.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed p-3 text-xs" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
                    No active demand bands. The engine will use its compatibility peak/off-peak rule.
                  </div>
                )}
              </div>

              {showDayparts && (
                <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  {(payload.daypartPolicies ?? []).map((row, index) => (
                    <div key={row.daypartPolicyId ?? `${row.daypartCode}-${index}`}
                      className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] sm:items-end"
                      style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>Daypart</span>
                        <select value={row.daypartCode} onChange={(event) => updateDaypart(index, { daypartCode: event.target.value as ShowtimeDaypart })}
                          className="h-9 w-full rounded-lg border px-2 text-xs font-semibold outline-none" style={fieldStyle()}>
                          {DAYPART_OPTIONS.map((code) => <option key={code} value={code}>{DAYPART_LABELS[code]}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>Start</span>
                        <input type="time" value={timeLabel(row.startTime)} onChange={(event) => updateDaypart(index, { startTime: `${event.target.value}:00` })}
                          className="h-9 w-full rounded-lg border px-2 text-xs outline-none" style={fieldStyle()} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>End</span>
                        <input type="time" value={timeLabel(row.endTime)} onChange={(event) => updateDaypart(index, { endTime: `${event.target.value}:00` })}
                          className="h-9 w-full rounded-lg border px-2 text-xs outline-none" style={fieldStyle()} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>Weekday ×</span>
                        <input type="number" min="0" step="0.05" value={row.weekdayDemandMultiplier}
                          onChange={(event) => updateDaypart(index, { weekdayDemandMultiplier: Number(event.target.value) })}
                          className="h-9 w-full rounded-lg border px-2 text-xs outline-none" style={fieldStyle(row.weekdayDemandMultiplier < 0)} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>Weekend ×</span>
                        <input type="number" min="0" step="0.05" value={row.weekendDemandMultiplier}
                          onChange={(event) => updateDaypart(index, { weekendDemandMultiplier: Number(event.target.value) })}
                          className="h-9 w-full rounded-lg border px-2 text-xs outline-none" style={fieldStyle(row.weekendDemandMultiplier < 0)} />
                      </label>
                      <div className="flex h-9 items-center gap-1">
                        <button type="button" onClick={() => updateDaypart(index, { active: !row.active })}
                          className="rounded-lg border px-2 py-1.5 text-[10px] font-bold"
                          style={{ borderColor: "var(--border-color)", color: row.active ? "#059669" : "var(--text-sub)" }}>
                          {row.active ? "On" : "Off"}
                        </button>
                        <button type="button" onClick={() => removeDaypart(index)} className="rounded-lg p-2 text-rose-500" aria-label={`Remove ${row.daypartCode}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addDaypart} disabled={(payload.daypartPolicies ?? []).length >= DAYPART_OPTIONS.length}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                    <Plus size={13} /> Add demand band
                  </button>
                </div>
              )}
            </SectionCard>

            {formats.length > 0 && (
              <SectionCard
                icon={BarChart3}
                title="Format preferences"
                description="Use a simple business priority. Room capability remains a hard eligibility rule."
                right={
                  <button type="button" onClick={() => setShowFormats((current) => !current)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                    {showFormats ? "Done" : "Edit priorities"} <ChevronDown size={13} className={`transition ${showFormats ? "rotate-180" : ""}`} />
                  </button>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {formats.map((format) => {
                    const priority = priorityByFormat.get(format.formatId);
                    return (
                      <span key={format.formatId} className="rounded-lg border px-2.5 py-1.5 text-xs"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                        <b>{format.formatCode}</b> · {formatPriorityLabel(priority)}
                      </span>
                    );
                  })}
                </div>
                {showFormats && (
                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: "var(--border-color)" }}>
                    {formats.map((format) => {
                      const priority = priorityByFormat.get(format.formatId);
                      const selected = priority == null ? "NONE" : priority >= 80 ? "100" : priority >= 50 ? "60" : "30";
                      return (
                        <label key={format.formatId}>
                          <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>
                            {format.formatName} ({format.formatCode})
                          </span>
                          <select value={selected} onChange={(event) => setFormatPriority(format.formatId, event.target.value)}
                            className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none" style={fieldStyle()}>
                            <option value="NONE">Not preferred</option>
                            <option value="30">Low</option>
                            <option value="60">Normal</option>
                            <option value="100">High</option>
                          </select>
                        </label>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}

            <details className="group rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500" style={{ background: "var(--bg-main)" }}>
                    <SlidersHorizontal size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold" style={{ color: "var(--text-main)" }}>Advanced optimizer settings</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--text-sub)" }}>Technical configuration for scheduling engineers and controlled rollout.</span>
                  </span>
                </span>
                <ChevronDown size={16} className="shrink-0 transition group-open:rotate-180" style={{ color: "var(--text-sub)" }} />
              </summary>
              <div className="space-y-5 border-t p-4 sm:p-5" style={{ borderColor: "var(--border-color)" }}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label>
                    <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>Policy code</span>
                    <input value={payload.policyCode} onChange={(event) => setPayload((current) => ({ ...current, policyCode: event.target.value.toUpperCase() }))}
                      className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none" style={fieldStyle(!payload.policyCode.trim())} />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>Business timezone</span>
                    <input value={payload.businessTimezone} onChange={(event) => setPayload((current) => ({ ...current, businessTimezone: event.target.value }))}
                      className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none" style={fieldStyle(!payload.businessTimezone.trim())} />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>Optimizer mode</span>
                    <select value={payload.defaultOptimizerMode} onChange={(event) => setPayload((current) => ({ ...current, defaultOptimizerMode: event.target.value as ShowtimeAllocationPolicyPayload["defaultOptimizerMode"] }))}
                      className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none" style={fieldStyle()}>
                      {Object.entries(OPTIMIZER_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Scoring factors</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {([
                      ["Movie demand", "movieDemandWeight"],
                      ["Cinema demand", "clusterDemandWeight"],
                      ["Time-slot demand", "timeSlotDemandWeight"],
                      ["Format demand", "formatDemandWeight"],
                      ["Capacity fit", "roomCapacityWeight"],
                    ] as Array<[string, NumericKey]>).map(([label, key]) => (
                      <NumberField key={key} label={label} value={payload[key]} step="0.01" min="0"
                        onChange={(value) => setPayload((current) => ({ ...current, [key]: value }))} />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px]" style={{ color: sameNumber(scoreWeightTotal, 1) ? "#059669" : "#d97706" }}>
                    Total: {(scoreWeightTotal * 100).toFixed(0)}% {sameNumber(scoreWeightTotal, 1) ? "· normalized" : "· choose a preset to normalize"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label="Slot interval" value={payload.timeSlotIntervalMinutes}
                    onChange={(value) => setPayload((current) => ({ ...current, timeSlotIntervalMinutes: value }))}
                    min="1" suffix="min" />
                  <NumberField label="Solve time limit" value={payload.maxSolveTimeSeconds}
                    onChange={(value) => setPayload((current) => ({ ...current, maxSolveTimeSeconds: value }))}
                    min="1" suffix="sec" />
                  <NumberField label="Search workers" value={payload.solverSearchWorkers}
                    onChange={(value) => setPayload((current) => ({ ...current, solverSearchWorkers: value }))}
                    min="1" />
                  <NumberField label="Relative gap" value={payload.solverRelativeGap}
                    onChange={(value) => setPayload((current) => ({ ...current, solverRelativeGap: value }))}
                    min="0" step="0.001" />
                  <NumberField label="Random seed" value={payload.solverRandomSeed}
                    onChange={(value) => setPayload((current) => ({ ...current, solverRandomSeed: value }))} />
                  <NumberField label="Candidate cap / movie / day" value={payload.maxCandidatesPerMoviePerDay}
                    onChange={(value) => setPayload((current) => ({ ...current, maxCandidatesPerMoviePerDay: value || undefined }))}
                    min="0" hint="Blank means no explicit cap." />
                  <NumberField label="Compatibility peak score" value={payload.peakDemandWeight}
                    onChange={(value) => setPayload((current) => ({ ...current, peakDemandWeight: value }))}
                    min="0" step="0.05" hint="Used only when no configured daypart matches." />
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>Peak start</span>
                      <input type="time" value={timeLabel(payload.peakStartTime)}
                        onChange={(event) => setPayload((current) => ({ ...current, peakStartTime: `${event.target.value}:00` }))}
                        className="h-10 w-full rounded-xl border px-2 text-xs outline-none" style={fieldStyle()} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-sub)" }}>Peak end</span>
                      <input type="time" value={timeLabel(payload.peakEndTime)}
                        onChange={(event) => setPayload((current) => ({ ...current, peakEndTime: `${event.target.value}:00` }))}
                        className="h-10 w-full rounded-xl border px-2 text-xs outline-none" style={fieldStyle()} />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-main)" }}>
                    <input type="checkbox" checked={payload.optimizerFallbackToLegacyOnError}
                      onChange={(event) => setPayload((current) => ({ ...current, optimizerFallbackToLegacyOnError: event.target.checked }))} />
                    Fall back to Legacy on solver error
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-main)" }}>
                    <input type="checkbox" checked={payload.solverLogSearchProgress}
                      onChange={(event) => setPayload((current) => ({ ...current, solverLogSearchProgress: event.target.checked }))} />
                    Log solver search progress
                  </label>
                </div>
              </div>
            </details>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-2xl border p-4" style={{ borderColor: validation.errors.length ? "rgba(220,38,38,.35)" : "var(--border-color)", background: "var(--bg-card)" }}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gauge size={15} className={validation.errors.length ? "text-rose-500" : "text-emerald-500"} />
                  <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Policy impact</h3>
                </div>
                <span className="rounded-full px-2 py-1 text-[10px] font-bold"
                  style={{
                    color: validation.errors.length ? "#dc2626" : "#059669",
                    background: validation.errors.length ? "rgba(220,38,38,.10)" : "rgba(5,150,105,.10)",
                  }}>
                  {validation.errors.length ? `${validation.errors.length} blocked` : "Ready"}
                </span>
              </div>
              <dl className="space-y-3 text-xs">
                {[
                  ["Scope", "Global default"],
                  ["Strategy", selectedStrategy === "CUSTOM" ? "Custom" : STRATEGIES[selectedStrategy].label],
                  ["Planning window", `D+${payload.planningHorizonStartDays} to D+${payload.planningHorizonEndDays}`],
                  ["Max concurrent screens", `${Math.round(payload.maximumRoomShare * 100)}%`],
                  ["Demand bands", `${activeDayparts.length} active`],
                  ["Preferred formats", preferredFormats.length ? String(preferredFormats.length) : "No override"],
                  ["Optimizer", OPTIMIZER_META[payload.defaultOptimizerMode]?.label ?? payload.defaultOptimizerMode],
                ].map(([term, detail]) => (
                  <div key={term} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: "var(--border-color)" }}>
                    <dt style={{ color: "var(--text-sub)" }}>{term}</dt>
                    <dd className="text-right font-semibold" style={{ color: "var(--text-main)" }}>{detail}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  <ShieldCheck size={15} /> Configuration review
                </h3>
                <div className="space-y-2">
                  {validation.errors.map((message) => (
                    <p key={message} className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5"
                      style={{ color: "#dc2626", background: "rgba(220,38,38,.08)" }}>
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {message}
                    </p>
                  ))}
                  {validation.warnings.map((message) => (
                    <p key={message} className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5"
                      style={{ color: "#b45309", background: "rgba(217,119,6,.08)" }}>
                      <Info size={13} className="mt-0.5 shrink-0" /> {message}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border p-4" style={{ borderColor: "rgba(37,99,235,.25)", background: "rgba(37,99,235,.06)" }}>
              <p className="flex items-center gap-2 text-xs font-bold text-blue-600"><Info size={13} /> Current rollout</p>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
                Runs currently resolve only the active policy whose code is <b>DEFAULT</b>. Market-area and cinema-level inheritance are not available yet.
              </p>
            </section>

            {saveError && (
              <p className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5"
                style={{ borderColor: "rgba(220,38,38,.3)", color: "#dc2626", background: "rgba(220,38,38,.08)" }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {saveError}
              </p>
            )}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-main)" }}>
            <Settings2 size={15} className="text-blue-600" /> Scheduling policies
          </h2>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
            Configure business strategy and operational guardrails. Only the active <b>DEFAULT</b> policy is currently used by generation runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
            <RefreshCw size={13} /> Refresh
          </button>
          {policies.some((policy) => policy.policyCode === DEFAULT_POLICY_CODE) ? (
            <button type="button"
              onClick={() => openEdit(policies.find((policy) => policy.policyCode === DEFAULT_POLICY_CODE)!)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
              <Settings2 size={13} /> Edit default
            </button>
          ) : (
            <button type="button" onClick={openCreate} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
              <Plus size={13} /> Create default
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border p-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }}>
          <RefreshCw size={16} className="animate-spin" /> Loading policies…
        </div>
      ) : error ? (
        <p className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(220,38,38,.3)", color: "#dc2626", background: "rgba(220,38,38,.06)" }}>{error}</p>
      ) : policies.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <Target size={24} className="mx-auto mb-3 text-blue-600" />
          <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>No scheduling policy yet</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Create the DEFAULT policy to define strategy and operational guardrails.</p>
          <button type="button" onClick={openCreate} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Create default policy</button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {policies.map((policy) => {
            const strategy = strategyFor(toPayload(policy));
            const usable = policy.policyCode === DEFAULT_POLICY_CODE && policy.active;
            return (
              <article key={policy.policyId} className="rounded-2xl border p-4" style={{ borderColor: usable ? "rgba(5,150,105,.35)" : "var(--border-color)", background: "var(--bg-card)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{policy.policyCode}</h3>
                      <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase"
                        style={{ color: usable ? "#059669" : "var(--text-sub)", background: usable ? "rgba(5,150,105,.10)" : "var(--bg-main)" }}>
                        {usable ? "In use" : policy.active ? "Active · not assigned" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                      {strategy === "CUSTOM" ? "Custom strategy" : STRATEGIES[strategy].label} · D+{policy.planningHorizonStartDays}–D+{policy.planningHorizonEndDays} · {Math.round(policy.maximumRoomShare * 100)}% max screens
                    </p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-blue-600" style={{ background: "rgba(37,99,235,.10)" }}>
                    {usable ? <ShieldCheck size={17} /> : <Settings2 size={17} />}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                  <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>
                    {OPTIMIZER_META[policy.defaultOptimizerMode]?.label ?? policy.defaultOptimizerMode}
                    {policy.updatedAt ? ` · Updated ${new Date(policy.updatedAt).toLocaleDateString()}` : ""}
                  </p>
                  <div className="flex gap-2">
                    {!policy.active && policy.policyCode === DEFAULT_POLICY_CODE && (
                      <button type="button" onClick={() => activate(policy.policyId)} disabled={activatingId === policy.policyId}
                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ borderColor: "var(--border-color)", color: "#059669" }}>
                        {activatingId === policy.policyId ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Activate
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(policy)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                      Edit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
