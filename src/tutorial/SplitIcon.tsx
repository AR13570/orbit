export default function SplitIcon({ split }: { split: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 12H21M19 10l2 2-2 2" />
      {split && (
        <>
          <path d="M8 12 18 3M16 3h2v2" />
          <path d="M8 12 18 21M16 21h2v-2" />
        </>
      )}
    </svg>
  );
}
