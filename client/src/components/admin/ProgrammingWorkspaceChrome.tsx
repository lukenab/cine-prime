import type { ElementType, ReactNode } from "react";

export type WorkspaceSummaryItem = {
  label: string;
  value: number | string;
  helper?: string;
  icon: ElementType;
  iconColor: string;
  iconBackground: string;
  onSelect?: () => void;
};

export function WorkspaceSummaryStrip({ items }: { items: WorkspaceSummaryItem[] }) {
  const columns = items.length >= 4 ? "xl:grid-cols-4" : "md:grid-cols-3";

  return (
    <section
      className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${columns}`}
      aria-label="Workspace summary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <div className="flex w-full items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[12px] font-medium" style={{ color: "var(--text-sub)" }}>{item.label}</span>
              <strong className="mt-2 block text-[27px] leading-none" style={{ color: "var(--text-main)" }}>{item.value}</strong>
              {item.helper && <small className="mt-2 block truncate text-[11.5px]" style={{ color: "var(--text-sub)" }}>{item.helper}</small>}
            </div>
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ color: item.iconColor, background: item.iconBackground }}
              aria-hidden="true"
            >
              <Icon size={20} strokeWidth={1.9} />
            </span>
          </div>
        );

        const className = "min-h-[122px] rounded-2xl border px-5 py-5 text-left shadow-sm";
        const style = { borderColor: "var(--border-color)", background: "var(--bg-card)" };

        return item.onSelect ? (
          <button
            key={item.label}
            type="button"
            className={`${className} transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
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
  ariaLabel,
  icon: Icon,
  iconColor = "#2563eb",
  iconBackground = "rgba(37,99,235,.10)",
  actions,
  children,
  footer,
}: {
  title?: string;
  description?: string;
  ariaLabel?: string;
  icon?: ElementType;
  iconColor?: string;
  iconBackground?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section aria-label={ariaLabel ?? title}>
      {hasHeader && <header className="mb-3 flex min-h-[54px] items-center justify-between gap-4 px-1">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ color: iconColor, background: iconBackground }}
              aria-hidden="true"
            >
              <Icon size={18} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{title}</h2>}
            {description && <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-sub)" }}>{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      >
        {children}
        {footer && <footer className="border-t px-5 py-3.5" style={{ borderColor: "var(--border-color)" }}>{footer}</footer>}
      </div>
    </section>
  );
}
