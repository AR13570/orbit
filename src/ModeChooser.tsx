import Icon from "./components/Icon";
import Attribution from "./components/Attribution";

export type OrbitMode = "odessey" | "gravity" | "creator";
export default function ModeChooser({
  onSelect,
  onHelp,
}: {
  onSelect: (mode: OrbitMode) => void;
  onHelp: (mode: "odessey" | "gravity") => void;
}) {
  return (
    <main className="mode-chooser">
      <div className="mode-intro">
        <img
          className="mode-logo"
          src="/orbit.svg"
          alt=""
          width="56"
          height="56"
        />
        <p className="mode-eyebrow">A little space to play</p>
        <h1>Orbit</h1>
        <p>Follow a path. Or make a world of your own.</p>
      </div>
      <div className="mode-selection">
        <div className="mode-options" aria-label="Choose a mode">
          <div className="mode-option">
            <button className="mode-choice" onClick={() => onSelect("odessey")}>
              <svg
                className="mode-art"
                viewBox="0 0 200 110"
                aria-hidden="true"
              >
                <circle cx="100" cy="55" r="23" fill="currentColor" />
                <path
                  d="M20 85C55 85 50 10 110 15S155 85 185 30"
                  fill="none"
                  stroke="#527c9a"
                  strokeWidth="1.5"
                  strokeDasharray="2 5"
                />
                <circle cx="180" cy="42" r="5" fill="#527c9a" />
              </svg>
              <span className="mode-name">Odessey</span>
              <span className="mode-description">
                Follow the pull.
                <br />
                Find the next checkpoint.
              </span>
              <span className="mode-enter">
                Free flight <Icon name="play" />
              </span>
            </button>
            <button
              className="mode-help"
              aria-label="How to play Odessey"
              onClick={() => onHelp("odessey")}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <path d="M10 5C8 3.5 5 3.5 2.5 4v11c2.5-.5 5.5-.5 7.5 1 2-1.5 5-1.5 7.5-1V4c-2.5-.5-5.5-.5-7.5 1Zm0 0v11" />
              </svg>
              How to play
            </button>
          </div>
          <div className="mode-option">
            <button className="mode-choice" onClick={() => onSelect("gravity")}>
              <svg
                className="mode-art"
                viewBox="0 0 200 110"
                aria-hidden="true"
              >
                <ellipse
                  cx="100"
                  cy="55"
                  rx="68"
                  ry="35"
                  fill="none"
                  stroke="#476f9b"
                  strokeWidth="1.2"
                  transform="rotate(-20 100 55)"
                />
                <ellipse
                  cx="100"
                  cy="55"
                  rx="44"
                  ry="44"
                  fill="none"
                  stroke="#a45c52"
                  strokeWidth="1.2"
                />
                <circle cx="100" cy="55" r="19" fill="currentColor" />
                <circle cx="162" cy="33" r="3.5" fill="#476f9b" />
                <circle cx="78" cy="93" r="3.5" fill="#a45c52" />
              </svg>
              <span className="mode-name">Gravity</span>
              <span className="mode-description">
                Build living orbits.
                <br />
                Solve an endless sky.
              </span>
              <span className="mode-enter">
                Orbital puzzles <Icon name="play" />
              </span>
            </button>
            <button
              className="mode-help"
              aria-label="How to play Gravity"
              onClick={() => onHelp("gravity")}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <path d="M10 5C8 3.5 5 3.5 2.5 4v11c2.5-.5 5.5-.5 7.5 1 2-1.5 5-1.5 7.5-1V4c-2.5-.5-5.5-.5-7.5 1Zm0 0v11" />
              </svg>
              How to play
            </button>
          </div>
        </div>
        <button className="mode-creator" onClick={() => onSelect("creator")}>
          <Icon name="edit" /> Gravity creator
          <span>
            Design your own puzzle <Icon name="play" />
          </span>
        </button>
      </div>
      <footer className="mode-footer">
        <p>No lives. No rush. Just one more launch.</p>
        <Attribution />
      </footer>
    </main>
  );
}
