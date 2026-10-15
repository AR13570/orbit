export default function Icon({
  name,
}: {
  name:
    | "sound"
    | "muted"
    | "help"
    | "pause"
    | "play"
    | "skip"
    | "back"
    | "edit"
    | "move"
    | "check"
    | "close"
    | "drag"
    | "orbit"
    | "flag"
    | "reset"
    | "duplicate"
    | "swap"
    | "grid"
    | "path"
    | "trash";
}) {
  const paths = {
    sound: (
      <>
        <path d="m11 5-5 4H3v6h3l5 4V5Z" />
        <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    muted: (
      <>
        <path d="m11 5-5 4H3v6h3l5 4V5Z" />
        <path d="m16 9 6 6m0-6-6 6" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2m0 3h.01" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7V5Z" />,
    skip: <path d="m5 5 10 7-10 7V5Zm14 0v14" />,
    back: <path d="M20 12H4m7-7-7 7 7 7" />,
    edit: <path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14v6Z" />,
    move: (
      <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3" />
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    drag: <path d="M5 9h14m-4-4 4 4-4 4M19 15H5m4-4-4 4 4 4" />,
    orbit: (
      <>
        <ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    flag: <path d="M5 21V3m0 1h13l-3 4 3 4H5" />,
    reset: <path d="M4 10a8 8 0 1 1 1.8 7M4 5v5h5" />,
    path: (
      <>
        <circle cx="5" cy="18" r="2" />
        <path d="M7 18c10 0 0-12 12-12m-3-3 3 3-3 3" />
      </>
    ),
    duplicate: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    swap: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
    trash: (
      <>
        <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
