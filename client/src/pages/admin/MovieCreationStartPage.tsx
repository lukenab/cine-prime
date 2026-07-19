import { ArrowLeft, FilePlus2, Library, Search, Sparkles } from "lucide-react";
import type { ElementType } from "react";
import { useNavigate } from "react-router-dom";

type CreationOptionProps = {
  icon: ElementType;
  title: string;
  description: string;
  bullets: string[];
  accent: string;
  iconBackground: string;
  actionLabel: string;
  onSelect: () => void;
};

function CreationOption({
  icon: Icon,
  title,
  description,
  bullets,
  accent,
  iconBackground,
  actionLabel,
  onSelect,
}: CreationOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex h-full flex-col rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: iconBackground, color: accent }}>
          <Icon size={23} />
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: iconBackground, color: accent }}>
          Draft workflow
        </span>
      </div>

      <h2 style={{ color: "var(--text-main)", fontSize: "17px", fontWeight: 700 }}>{title}</h2>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--text-sub)", fontSize: "13px" }}>{description}</p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2" style={{ color: "var(--text-sub)", fontSize: "12.5px" }}>
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: accent }} />
            {bullet}
          </li>
        ))}
      </ul>

      <span className="mt-6 inline-flex items-center gap-2 font-semibold transition-all group-hover:gap-3" style={{ color: accent, fontSize: "13px" }}>
        {actionLabel} <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}

export default function MovieCreationStartPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <button
        type="button"
        onClick={() => navigate("/admin/movies")}
        className="mb-6 inline-flex items-center gap-2 rounded-xl border px-3 py-2 transition-opacity hover:opacity-80"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)", fontSize: "13px" }}
      >
        <ArrowLeft size={15} /> Back to Movies
      </button>

      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FilePlus2 size={23} />
        </div>
        <h1 style={{ color: "var(--text-main)", fontSize: "24px", fontWeight: 750 }}>How would you like to create this movie?</h1>
        <p className="mx-auto mt-2 max-w-2xl" style={{ color: "var(--text-sub)", fontSize: "13.5px" }}>
          Start from the external catalog to reduce data entry, or create a clean draft when the title is not available there.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <CreationOption
          icon={Library}
          title="Import from catalog"
          description="Browse currently playing and upcoming releases, review the source data, then use the selected title as a draft."
          bullets={[
            "Browse Vietnam now-playing and upcoming catalogs",
            "Preview metadata before anything is saved",
            "Keep control of mappings, media and final review",
          ]}
          accent="#2563eb"
          iconBackground="rgba(37,99,235,0.10)"
          actionLabel="Browse catalog"
          onSelect={() => navigate("/admin/movies/new/catalog")}
        />

        <CreationOption
          icon={Sparkles}
          title="Create manually"
          description="Open an empty draft and enter the movie information directly. Best for local, private or not-yet-listed titles."
          bullets={[
            "Start with a clean content draft",
            "Add localized metadata and credits manually",
            "Save first and complete readiness checks later",
          ]}
          accent="#7c3aed"
          iconBackground="rgba(124,58,237,0.10)"
          actionLabel="Open blank draft"
          onSelect={() => navigate("/admin/movies/new/manual")}
        />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border px-4 py-3" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", fontSize: "12px" }}>
        <Search size={13} /> Browsing and previewing the catalog never creates a local movie record.
      </div>
    </div>
  );
}
