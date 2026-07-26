import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Check, Clapperboard, Film, Images, Languages, ListChecks, Users } from "lucide-react";

export type MovieEditorSectionId =
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
}

export const MOVIE_EDITOR_SECTION_META = [
  { id: "overview", label: "Overview", description: "Core identity and localized editorial copy.", icon: Film },
  {
    id: "classification-release",
    label: "Classification & Release",
    description: "Runtime, release window, ratings and catalogue genres.",
    icon: Clapperboard,
  },
  {
    id: "screening-versions",
    label: "Screening Versions",
    description: "Presentation, audio system and language combinations used by scheduling.",
    icon: Languages,
  },
  { id: "media", label: "Media", description: "Poster, trailer and gallery assets.", icon: Images },
  { id: "credits", label: "Credits", description: "Production companies, cast and crew billing.", icon: Users },
  { id: "review", label: "Review", description: "Catalog provenance, import warnings and readiness checks.", icon: ListChecks },
] as const;

const SECTION_IDS = new Set<MovieEditorSectionId>(MOVIE_EDITOR_SECTION_META.map((section) => section.id));

export const movieEditorSectionDomId = (id: MovieEditorSectionId) => `movie-editor-section-${id}`;

function sectionFromHash(): MovieEditorSectionId {
  const candidate = window.location.hash.replace(/^#/, "") as MovieEditorSectionId;
  return SECTION_IDS.has(candidate) ? candidate : "overview";
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
      aria-label="Movie editor sections"
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
                aria-controls={movieEditorSectionDomId(section.id)}
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
                  style={{ background: active ? (section.hasError ? "#ef4444" : "#2563eb") : (section.hasError ? "#fef2f2" : "var(--bg-main)"), color: active ? "white" : (section.hasError ? "#ef4444" : "var(--text-sub)") }}
                >
                  {section.hasError ? <AlertCircle size={14} aria-label="Error" /> : (section.complete && !active ? <Check size={14} aria-label="Complete" /> : <Icon size={14} aria-hidden="true" />)}
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
}

export default function MovieEditorWorkflow({ sections, children }: MovieEditorWorkflowProps) {
  const [activeSection, setActiveSection] = useState<MovieEditorSectionId>(() => sectionFromHash());
  const availableIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);

  const updateHash = useCallback((id: MovieEditorSectionId) => {
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`);
    }
  }, []);

  const navigateToSection = useCallback((id: MovieEditorSectionId) => {
    const target = document.getElementById(movieEditorSectionDomId(id));
    if (!target) return;
    setActiveSection(id);
    updateHash(id);
    target.scrollIntoView?.({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }, [updateHash]);

  useEffect(() => {
    const onHashChange = () => {
      const id = sectionFromHash();
      if (!availableIds.has(id)) return;
      const target = document.getElementById(movieEditorSectionDomId(id));
      if (!target) return;
      setActiveSection(id);
      target.scrollIntoView?.({ block: "start" });
      target.focus({ preventScroll: true });
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [availableIds]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
        const id = visible?.target.getAttribute("data-editor-section") as MovieEditorSectionId | null;
        if (!id || !availableIds.has(id)) return;
        setActiveSection((current) => {
          if (current === id) return current;
          updateHash(id);
          return id;
        });
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.1, 0.5] },
    );

    sections.forEach((section) => {
      const element = document.getElementById(movieEditorSectionDomId(section.id));
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [availableIds, sections, updateHash]);

  useEffect(() => {
    const initial = sectionFromHash();
    if (initial !== "overview" && availableIds.has(initial)) {
      requestAnimationFrame(() => {
        document.getElementById(movieEditorSectionDomId(initial))?.scrollIntoView?.({ block: "start" });
      });
    }
  }, [availableIds]);

  return (
    <div>
      <div
        className="sticky top-20 z-30 -mx-1 mb-5 border-y px-1 py-2 backdrop-blur lg:hidden"
        style={{ background: "color-mix(in srgb, var(--bg-main) 92%, transparent)", borderColor: "var(--border-color)" }}
      >
        <SectionNavigation activeSection={activeSection} sections={sections} onNavigate={navigateToSection} compact />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_3fr]">
        <aside className="sticky top-6 hidden lg:block">
          <SectionNavigation activeSection={activeSection} sections={sections} onNavigate={navigateToSection} />
        </aside>

        <main className="flex min-w-0 flex-col gap-6" aria-label="Movie editor workflow">{children}</main>
      </div>
    </div>
  );
}
