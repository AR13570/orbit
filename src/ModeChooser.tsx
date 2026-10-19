import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Icon from "./components/Icon";
import Attribution from "./components/Attribution";
import ModePreview from "./home/ModePreview";
import ThemeControl from "./components/ThemeControl";
import { readHomeProgress } from "./home/progress";

export type OrbitMode = "odessey" | "gravity" | "creator";
const modes = [
  {
    id: "odessey",
    name: "Odessey",
    description:
      "Curve past attractors and repellers to reach each checkpoint. Split your shot to find another way through.",
  },
  {
    id: "gravity",
    name: "Gravity",
    description:
      "Build living systems, one planet at a time. Find lasting orbits around cores and through repeller fields, then explore an endless sky.",
  },
] as const;

export default function ModeChooser({
  onSelect,
  onHelp,
}: {
  onSelect: (mode: OrbitMode) => void;
  onHelp: (mode: "odessey" | "gravity") => void;
}) {
  const screen = useRef<HTMLElement>(null);
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
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from(".home-brand img", {
            opacity: 0,
            scale: 0.94,
            duration: 0.45,
            clearProps: "transform,opacity",
          })
          .from(
            ".home-title-letter",
            {
              yPercent: -80,
              opacity: 0,
              duration: 0.6,
              stagger: 0.065,
              ease: "back.out(1.2)",
              clearProps: "transform,opacity",
            },
            0.06,
          )
          .from(
            ".home-brand-copy p",
            {
              y: 6,
              opacity: 0,
              duration: 0.4,
              clearProps: "transform,opacity",
            },
            0.25,
          )
          .from(
            ".home-mode",
            {
              y: 16,
              opacity: 0,
              duration: 0.5,
              stagger: 0.09,
              clearProps: "transform,opacity",
            },
            0.3,
          )
          .from(
            ".home-create, .home-footer",
            { opacity: 0, duration: 0.4, stagger: 0.06, clearProps: "opacity" },
            0.5,
          );
      },
      screen,
    );
    return () => media.revert();
  }, []);
  return (
    <main className="home-screen" ref={screen}>
      <ThemeControl compact />
      <header className="home-header">
        <div className="home-brand">
          <img
            src={`${import.meta.env.BASE_URL}orbit-mark.svg`}
            alt=""
            width="120"
            height="120"
          />
          <div className="home-brand-copy">
            <h1 aria-label="Orbit">
              {Array.from("Orbit", (letter, index) => (
                <span
                  className="home-title-letter"
                  aria-hidden="true"
                  key={index}
                >
                  {letter}
                </span>
              ))}
            </h1>
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
