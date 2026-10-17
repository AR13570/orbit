import { useEffect, useState } from "react";
import Icon from "./components/Icon";
import Attribution from "./components/Attribution";
import ModePreview from "./home/ModePreview";
import { readHomeProgress } from "./home/progress";

export type OrbitMode = "odessey" | "gravity" | "creator";
const modes = [
  {
    id: "odessey",
    name: "Odessey",
    description: "Curve your shot to the next checkpoint.",
  },
  {
    id: "gravity",
    name: "Gravity",
    description: "Launch planets. Build living orbits.",
  },
] as const;

export default function ModeChooser({
  onSelect,
  onHelp,
}: {
  onSelect: (mode: OrbitMode) => void;
  onHelp: (mode: "odessey" | "gravity") => void;
}) {
  const [progress] = useState(() => readHomeProgress(window.location.search));
  const [motion, setMotion] = useState(
    () =>
      !document.hidden &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!document.hidden && !media?.matches);
    media?.addEventListener?.("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media?.removeEventListener?.("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <main className="home-screen">
      <header className="home-header">
        <div className="home-brand">
          <img src="/orbit.svg" alt="" width="120" height="120" />
          <div className="home-brand-copy">
            <h1>Orbit</h1>
            <p>A little space to play.</p>
          </div>
        </div>
      </header>
      <div className="home-content">
        <div className="home-modes" aria-label="Choose a mode">
          {modes.map((mode) => (
            <section
              className={`home-mode home-mode-${mode.id}`}
              key={mode.id}
              aria-labelledby={`home-title-${mode.id}`}
            >
              <ModePreview mode={mode.id} motion={motion} />
              <div className="home-mode-copy">
                <div className="home-mode-heading">
                  <h2 id={`home-title-${mode.id}`}>{mode.name}</h2>
                  {progress[mode.id] &&
                    progress[mode.id] !==
                      (mode.id === "odessey" ? "Checkpoint 0" : "Level 1") && (
                      <>
                        <span
                          className="home-mode-divider"
                          aria-hidden="true"
                        />
                        <p className="home-progress">{progress[mode.id]}</p>
                      </>
                    )}
                </div>
                <p className="home-description">{mode.description}</p>
              </div>
              <div className="home-actions">
                <div className="home-launch">
                  <button
                    className="home-play"
                    aria-label={`${progress[mode.id] ? "Continue" : "Play"} ${mode.name}`}
                    onClick={() => onSelect(mode.id)}
                  >
                    <span className="home-play-face">
                      <Icon name="play" />
                      {progress[mode.id] ? "Continue" : "Play"}
                    </span>
                  </button>
                </div>
                <button
                  className="home-help"
                  aria-label={`How to play ${mode.name}`}
                  onClick={() => onHelp(mode.id)}
                >
                  <span>How to play</span>
                  <Icon name="help" />
                </button>
              </div>
            </section>
          ))}
        </div>
        <button
          className="home-create"
          onClick={() => onSelect("creator")}
          aria-label="Gravity creator"
        >
          <Icon name="edit" />
          <span>Create a gravity puzzle</span>
        </button>
      </div>
      <footer className="home-footer">
        <Attribution />
      </footer>
    </main>
  );
}
