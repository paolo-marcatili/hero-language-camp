import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef
} from "react";
import { createPortal } from "react-dom";

let bodyScrollLockCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;

  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;

  return () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow;
    }
  };
}

export interface ModalShellProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly closeLabel?: string;
  readonly className?: string;
  readonly panelClassName?: string;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEscape?: boolean;
}

/**
 * Shared viewport-level modal used by Story, Study Book, Settings, progress,
 * and other overlays. It owns focus restoration, Escape handling, backdrop
 * dismissal, and background scroll locking.
 */
export function ModalShell({
  open,
  title,
  children,
  onClose,
  closeLabel = "Close",
  className,
  panelClassName,
  closeOnBackdrop = true,
  closeOnEscape = true
}: ModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previouslyFocused = document.activeElement;
    const unlockBodyScroll = lockBodyScroll();

    window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [closeOnEscape, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const overlayClassName = ["app-shell-modal", className]
    .filter(Boolean)
    .join(" ");
  const dialogClassName = ["app-shell-modal__dialog", panelClassName]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={overlayClassName} onMouseDown={handleBackdropClick}>
      <div
        ref={panelRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="app-shell-modal__header">
          <h2 id={titleId} className="app-shell-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="app-shell-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="app-shell-modal__content">{children}</div>
      </div>
    </div>,
    document.body
  );
}
