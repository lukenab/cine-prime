import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

export type RowAction = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
  hidden?: boolean;
};

type RowActionsProps = {
  ariaLabel: string;
  actions?: RowAction[];
  primaryAction?: RowAction;
  busy?: boolean;
  maxInlineActions?: number;
  forceMenu?: boolean;
  className?: string;
  menuClassName?: string;
};

/**
 * Consistent actions for administrative data-table rows.
 *
 * Use a labelled primary action only for a time-sensitive queue operation
 * (for example Review or Resolve). One to three icon actions are shown
 * directly; larger action sets move into the overflow menu.
 */
export function RowActions({
  ariaLabel,
  actions = [],
  primaryAction,
  busy = false,
  maxInlineActions = 3,
  forceMenu = false,
  className,
  menuClassName,
}: RowActionsProps) {
  const visibleActions = actions.filter((action) => !action.hidden);
  const showPrimary = primaryAction && !primaryAction.hidden;
  const showInlineActions = !showPrimary
    && !forceMenu
    && visibleActions.length <= maxInlineActions
    && visibleActions.every((action) => action.icon);

  if (!showPrimary && visibleActions.length === 0) {
    return <span className="inline-block w-9 text-center text-xs text-[var(--text-sub)]">—</span>;
  }

  const renderIcon = (action: RowAction) => {
    const Icon = action.icon;
    return Icon ? <Icon aria-hidden="true" /> : null;
  };

  return (
    <div
      className={cn("inline-flex items-center justify-end gap-1.5", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {showPrimary && (
        <button
          type="button"
          disabled={busy || primaryAction.disabled}
          title={primaryAction.disabledReason}
          onClick={primaryAction.onSelect}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
            "disabled:cursor-not-allowed disabled:opacity-45",
            primaryAction.destructive
              ? "bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400"
              : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 dark:text-blue-400",
          )}
        >
          {renderIcon(primaryAction)}
          {primaryAction.label}
        </button>
      )}

      {showInlineActions && visibleActions.map((action) => {
        const Icon = action.icon!;
        return (
          <button
            key={action.key}
            type="button"
            disabled={busy || action.disabled}
            aria-label={action.label}
            title={action.disabledReason ?? action.label}
            onClick={action.onSelect}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
              "disabled:cursor-not-allowed disabled:opacity-40",
              action.destructive
                ? "text-red-500 hover:bg-red-500/10"
                : "text-[var(--text-sub)] hover:bg-blue-500/10 hover:text-blue-500",
            )}
          >
            <Icon size={17} aria-hidden="true" />
          </button>
        );
      })}

      {!showInlineActions && visibleActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={ariaLabel}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg text-[var(--text-sub)] transition-colors",
                "hover:bg-black/5 hover:text-[var(--text-main)] dark:hover:bg-white/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={cn("w-56", menuClassName)}>
            {visibleActions.map((action, index) => {
              const showSeparator = action.separatorBefore && index > 0;
              return (
                <Fragment key={action.key}>
                  {showSeparator && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={busy || action.disabled}
                    title={action.disabledReason}
                    variant={action.destructive ? "destructive" : "default"}
                    onSelect={action.onSelect}
                  >
                    {renderIcon(action)}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                </Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
