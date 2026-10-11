export default function Icon({
  name,
}: {
  name: "sound" | "muted" | "help" | "pause" | "play" | "reset";
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
    reset: <path d="M4 10a8 8 0 1 1 1.8 7M4 5v5h5" />,
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
