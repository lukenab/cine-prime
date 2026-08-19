import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({ eyebrow, title, description, actions, className = "" }: AdminPageHeaderProps) {
  return (
    <header className={`mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <p
          className="uppercase text-blue-600"
          style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            margin: "5px 0 4px",
            color: "var(--text-main)",
            fontSize: 25,
            fontWeight: 750,
            letterSpacing: "-0.025em",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
