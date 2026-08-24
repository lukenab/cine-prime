import type { ElementType, ReactNode } from "react";

type MetricTone = "blue" | "emerald" | "amber" | "rose" | "violet";

type AdminMetricCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon: ElementType;
  tone?: MetricTone;
  loading?: boolean;
};

const toneClasses: Record<MetricTone, string> = {
  blue: "bg-blue-500/10 text-blue-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  amber: "bg-amber-500/10 text-amber-500",
  rose: "bg-rose-500/10 text-rose-500",
  violet: "bg-violet-500/10 text-violet-500",
};

export function AdminMetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "blue",
  loading = false,
}: AdminMetricCardProps) {
  return (
    <article className="flex min-h-28 items-start justify-between gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
      <div className="min-w-0">
        <p className="m-0 text-xs font-medium text-[var(--text-sub)]">{label}</p>
        <p className="mb-0 mt-2 text-3xl font-bold tracking-tight text-[var(--text-main)]">
          {loading ? "—" : value}
        </p>
        {description && <p className="mb-0 mt-2 text-[11px] text-[var(--text-sub)]">{description}</p>}
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
    </article>
  );
}
