import type { ReactNode } from "react";

export interface TopBarAction {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly hidden?: boolean;
  readonly className?: string;
}

export interface TopBarProps {
  readonly actions: readonly TopBarAction[];
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly ariaLabel?: string;
  readonly className?: string;
}

/**
 * Presentational toolbar shared by all courses. Course-specific code supplies
 * actions, while ordering and accessibility remain consistent.
 */
export function TopBar({
  actions,
  leading,
  trailing,
  ariaLabel = "Application controls",
  className
}: TopBarProps) {
  const rootClassName = ["app-shell-top-bar", className]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={rootClassName} aria-label={ariaLabel}>
      {leading ? (
        <div className="app-shell-top-bar__leading">{leading}</div>
      ) : null}

      <div className="app-shell-top-bar__actions">
        {actions.map((action) =>
          action.hidden ? null : (
            <button
              key={action.id}
              type="button"
              className={["app-shell-top-bar__action", action.className]
                .filter(Boolean)
                .join(" ")}
              onClick={action.onPress}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.label}
              aria-pressed={action.pressed}
            >
              {action.icon}
            </button>
          )
        )}
      </div>

      {trailing ? (
        <div className="app-shell-top-bar__trailing">{trailing}</div>
      ) : null}
    </nav>
  );
}
