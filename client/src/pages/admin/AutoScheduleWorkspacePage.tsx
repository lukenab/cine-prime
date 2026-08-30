import { useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import AutoScheduleShowtimePage from "./AutoScheduleShowtimePage";

type AutoScheduleWorkspacePageProps = { mode?: "create" | "review" };

export default function AutoScheduleWorkspacePage({ mode = "create" }: AutoScheduleWorkspacePageProps) {
  const [searchParams] = useSearchParams();
  const parsedRunId = Number(searchParams.get("runId"));
  const runId = Number.isInteger(parsedRunId) && parsedRunId > 0 ? parsedRunId : null;

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-5 pb-8">
      <AdminPageHeader
        eyebrow="Film programming"
        title={mode === "review" ? "Schedule Review" : "Automatic Scheduling"}
        description={mode === "review"
          ? "Review schedule impact, validation results and exceptions before making an independent decision."
          : "Define the planning scope, validate scheduling prerequisites and submit a generated plan for review."}
      />

      <AutoScheduleShowtimePage embedded initialRunId={runId} workspaceMode={mode} />
    </div>
  );
}
