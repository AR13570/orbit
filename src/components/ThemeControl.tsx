import { useTheme } from "../theme";

export default function ThemeControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={compact ? "theme-control" : "pause-option"}
      aria-label={
        compact ? `Switch to ${dark ? "light" : "dark"} mode` : "Dark mode"
      }
      aria-pressed={dark}
      title={compact ? `Switch to ${dark ? "light" : "dark"} mode` : undefined}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10 10.5Z" />
        )}
      </svg>
      {!compact && (
        <>
          <span>Dark mode</span>
          <span className="pause-switch" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
