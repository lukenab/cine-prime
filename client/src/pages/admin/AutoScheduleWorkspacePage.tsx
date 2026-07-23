import { ArrowLeft, CalendarCog } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import AutoScheduleShowtimePage from "./AutoScheduleShowtimePage";

export default function AutoScheduleWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parsedRunId = Number(searchParams.get("runId"));
  const runId = Number.isInteger(parsedRunId) && parsedRunId > 0 ? parsedRunId : null;

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Back to showtime workspace"
            onClick={() => navigate("/admin/showtimes")}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-blue-500/5"
            style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-card)" }}
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
            <CalendarCog size={21} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate" style={{ color: "var(--text-main)", fontSize: "24px", fontWeight: 750, letterSpacing: "-0.015em" }}>
              Automatic schedule workspace
            </h1>
            <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "14px" }}>
              Define the planning scope, validate scheduling prerequisites, and publish the generated plan.
            </p>
          </div>
        </div>
        {!runId && <span
          className="rounded-full border px-3 py-1.5"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)", fontSize: "12.5px", fontWeight: 650 }}
        >
          Draft generation · Review required before publish
        </span>}
      </header>

      <AutoScheduleShowtimePage embedded initialRunId={runId} />
    </div>
  );
}
