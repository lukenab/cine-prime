import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Film, Images, Languages, ListChecks } from "lucide-react";

export type MovieEditorSectionId =
  | "details"
  | "media-credits"
  | "screening-versions"
  | "review";

export type MovieEditorContentSectionId =
  | "overview"
  | "classification-release"
  | "screening-versions"
  | "media"
  | "credits"
  | "review";

export interface MovieEditorSectionDefinition {
  id: MovieEditorSectionId;
  label: string;
  description: string;
  complete?: boolean;
  hasError?: boolean;
  blockNext?: boolean;
  blockNextMessage?: string;
}

export const MOVIE_EDITOR_SECTION_META = [
  {
    id: "details",
    label: "Movie information",
    description: "Identity, localized content and classification.",
    icon: Film,
  },
  {
    id: "media-credits",
    label: "Media & credits",
    description: "Customer-facing artwork, trailer, cast and companies.",
    icon: Images,
  },
  {
    id: "screening-versions",
    label: "Screening versions",
    description: "Presentation, audio and language combinations.",
    icon: Languages,
  },
  {
    id: "review",
    label: "Review & submit",
    description: "Resolve warnings and confirm catalogue readiness.",
    icon: ListChecks,
  },
] as const;

const SECTION_IDS = new Set<MovieEditorSectionId>(MOVIE_EDITOR_SECTION_META.map((section) => section.id));
const LEGACY_HASH_MAP: Record<string, MovieEditorSectionId> = {
  overview: "details",
  "classification-release": "details",
  media: "media-credits",
  credits: "media-credits",
};

export const movieEditorSectionDomId = (id: MovieEditorContentSectionId) => `movie-editor-section-${id}`;

function sectionFromHash(): MovieEditorSectionId {
  const candidate = window.location.hash.replace(/^#/, "");
  if (SECTION_IDS.has(candidate as MovieEditorSectionId)) return candidate as MovieEditorSectionId;
  return LEGACY_HASH_MAP[candidate] ?? "details";
}

interface SectionNavigationProps {
  activeSection: MovieEditorSectionId;
  sections: MovieEditorSectionDefinition[];
  onNavigate: (id: MovieEditorSectionId) => void;
  compact?: boolean;
}

function SectionNavigation({ activeSection, sections, onNavigate, compact = false }: SectionNavigationProps) {
  return (
    <nav
      aria-label="Movie creation progress"
      className={compact ? "overflow-x-auto" : "rounded-2xl border p-2"}
      style={compact ? undefined : { background: "var(--bg-card)", borderColor: "var(--border-color)" }}
    >
      <ol className={compact ? "flex min-w-max gap-2 px-1" : "space-y-1"}>
        {sections.map((section, index) => {
          const meta = MOVIE_EDITOR_SECTION_META.find((item) => item.id === section.id)!;
          const Icon = meta.icon;
          const active = activeSection === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onNavigate(section.id)}
                aria-current={active ? "step" : undefined}
                className={
                  compact
                    ? "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    : "group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                }
                style={{
                  background: active ? "color-mix(in srgb, #2563eb 10%, var(--bg-card))" : "transparent",
                  borderColor: compact ? (active ? "#2563eb" : "var(--border-color)") : undefined,
                  color: active ? "#2563eb" : "var(--text-main)",
                }}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: active
                      ? (section.hasError ? "#ef4444" : "#2563eb")
                      : (section.hasError ? "#fef2f2" : "var(--bg-main)"),
                    color: active ? "white" : (section.hasError ? "#ef4444" : "var(--text-sub)"),
                  }}
                >
                  {section.hasError
                    ? <AlertCircle size={14} aria-label="Needs attention" />
                    : section.complete && !active
                      ? <Check size={14} aria-label="Complete" />
                      : <Icon size={14} aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap" style={{ fontSize: "12.5px", fontWeight: active ? 700 : 600 }}>
                    <span className="mr-1 opacity-60">{index + 1}.</span>{section.label}
                  </span>
                  {!compact && (
                    <span className="mt-0.5 block leading-relaxed" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                      {section.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface MovieEditorWorkflowProps {
  sections: MovieEditorSectionDefinition[];
  children: ReactNode;
  onActiveSectionChange?: (id: MovieEditorSectionId) => void;
}

export default function MovieEditorWorkflow({
  sections,
  children,
  onActiveSectionChange,
}: MovieEditorWorkflowProps) {
  const [activeSection, setActiveSection] = useState<MovieEditorSectionId>(() => sectionFromHash());
  const availableIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);
  const sectionChangeHandler = useRef(onActiveSectionChange);
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));

  useEffect(() => {
    sectionChangeHandler.current = onActiveSectionChange;
  }, [onActiveSectionChange]);

  useEffect(() => {
    sectionChangeHandler.current?.(activeSection);
  }, [activeSection]);

  const updateHash = useCallback((id: MovieEditorSectionId) => {
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`);
    }
  }, []);

  const navigateToSection = useCallback((id: MovieEditorSectionId) => {
    if (!availableIds.has(id)) return;
    setActiveSection(id);
    updateHash(id);
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-workflow-step="${id}"]`);
      target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    });
  }, [availableIds, updateHash]);

  useEffect(() => {
    const onHashChange = () => {
      const id = sectionFromHash();
      if (availableIds.has(id)) navigateToSection(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [availableIds, navigateToSection]);

  const previousSection = activeIndex > 0 ? sections[activeIndex - 1] : null;
  const nextSection = activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null;

  return (
    <div data-movie-editor-workflow data-active-step={activeSection}>
      <style>{`
        [data-movie-editor-workflow] [data-workflow-step] { display: none; }
        [data-movie-editor-workflow][data-active-step="details"] [data-workflow-step="details"],
        [data-movie-editor-workflow][data-active-step="media-credits"] [data-workflow-step="media-credits"],
        [data-movie-editor-workflow][data-active-step="screening-versions"] [data-workflow-step="screening-versions"],
        [data-movie-editor-workflow][data-active-step="review"] [data-workflow-step="review"] { display: block; }
        [data-editor-surface] [data-workflow-step] {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 1.5rem 1.25rem !important;
        }
        [data-editor-surface] [data-workflow-step="details"]:not([data-editor-section="overview"]),
        [data-editor-surface] [data-workflow-step="media-credits"]:not([data-editor-section="media"]) {
          border-top: 1px solid var(--border-color) !important;
        }
      `}</style>

      <div
        className="sticky top-20 z-30 -mx-1 mb-5 border-y px-1 py-2 backdrop-blur lg:hidden"
        style={{ background: "color-mix(in srgb, var(--bg-main) 92%, transparent)", borderColor: "var(--border-color)" }}
      >
        <SectionNavigation activeSection={activeSection} sections={sections} onNavigate={navigateToSection} compact />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(220px,24%)_minmax(0,1fr)]">
        <aside className="sticky top-6 hidden lg:block">
          <SectionNavigation activeSection={activeSection} sections={sections} onNavigate={navigateToSection} />
        </aside>

        <main
          data-editor-surface
          className="min-w-0 overflow-hidden rounded-2xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          aria-label="Movie editor workflow"
        >
          <header
            className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{sections[activeIndex]?.label}</h2>
                <span className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
                  {activeIndex + 1} / {sections.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{sections[activeIndex]?.description}</p>
            </div>
            {sections[activeIndex]?.hasError && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle size={14} /> Needs attention
              </span>
            )}
          </header>

          <div className="flex min-w-0 flex-col">
            {children}
          </div>

          <footer
            className="flex items-center justify-between border-t px-5 py-3.5"
            style={{ borderColor: "var(--border-color)", background: "color-mix(in srgb, var(--bg-card) 94%, var(--bg-main))" }}
          >
            <button
              type="button"
              onClick={() => previousSection && navigateToSection(previousSection.id)}
              disabled={!previousSection}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:invisible"
              style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            {nextSection ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {sections[activeIndex]?.blockNext && (
                  <span className="max-w-xs text-right text-xs font-medium text-amber-600">
                    {sections[activeIndex]?.blockNextMessage ?? "Complete this step before continuing."}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigateToSection(nextSection.id)}
                  disabled={sections[activeIndex]?.blockNext}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to {nextSection.label} <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-sub)" }}>
                Resolve all blockers, then submit the movie for review from the page header.
              </p>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
