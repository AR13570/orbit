import { useEffect, useRef, type ReactNode } from "react";

export default function CreatorPopover({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target =
      panel.current?.querySelector<HTMLElement>("input") ??
      panel.current?.querySelector<HTMLElement>("button");
    target?.focus();
    const outside = (e: PointerEvent) => {
      if ((e.target as Element).closest?.("[data-creator-popup-trigger]"))
        return;
      if (!panel.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        previous?.focus?.();
        return;
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  return (
    <div
      ref={panel}
      className="creator-popover"
      role="dialog"
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
      </header>
      {children}
    </div>
  );
}
