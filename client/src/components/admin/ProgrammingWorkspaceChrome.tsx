import type { ReactNode } from "react";

export type WorkspaceSummaryItem = {
  label: string;
  value: number | string;
  helper?: string;
  onSelect?: () => void;
};

export function WorkspaceSummaryStrip({ items }: { items: WorkspaceSummaryItem[] }) {
  return (
    <section
      className="mb-6 grid overflow-hidden rounded-2xl border md:grid-flow-col md:auto-cols-fr"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      aria-label="Workspace summary"
    >
      {items.map((item, index) => {
        const content = (
          <>
            <span className="text-[12px] font-medium" style={{ color: "var(--text-sub)" }}>{item.label}</span>
            <strong className="mt-1.5 block text-[25px] leading-none" style={{ color: "var(--text-main)" }}>{item.value}</strong>
            {item.helper && <small className="mt-1.5 block truncate text-[11px]" style={{ color: "var(--text-sub)" }}>{item.helper}</small>}
          </>
        );

        const dividerClass = index === 0 ? "" : "border-t md:border-l md:border-t-0";
        const className = `${dividerClass} min-h-[102px] px-5 py-4 text-left`;
        const style = { borderColor: "var(--border-color)" };

        return item.onSelect ? (
          <button
            key={item.label}
            type="button"
            className={`${className} transition-colors hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`}
            style={style}
            onClick={item.onSelect}
          >
            {content}
          </button>
        ) : (
          <div key={item.label} className={className} style={style}>{content}</div>
        );
      })}
    </section>
  );
}

export type WorkspaceTab = {
  id: string;
  label: string;
  count: number;
};

export function WorkspaceTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: WorkspaceTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}) {
  return (
    <div
      className="mb-4 flex gap-7 overflow-x-auto border-b"
      style={{ borderColor: "var(--border-color)" }}
      role="tablist"
      aria-label="Workspace queues"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="relative flex min-h-11 shrink-0 items-center gap-2 px-0.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ color: active ? "#2563eb" : "var(--text-sub)" }}
          >
            {tab.label}
            <span
              className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10.5px] font-bold"
              style={{
                color: active ? "#2563eb" : "var(--text-sub)",
                background: active ? "rgba(37,99,235,.1)" : "rgba(148,163,184,.12)",
              }}
            >
              {tab.count}
            </span>
            {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceQueuePanel({
  title,
  description,
  actions,
  children,
  footer,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
    >
      <header className="flex min-h-[76px] items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{title}</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-sub)" }}>{description}</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      {children}
      {footer && <footer className="border-t px-5 py-3.5" style={{ borderColor: "var(--border-color)" }}>{footer}</footer>}
    </section>
  );
}
