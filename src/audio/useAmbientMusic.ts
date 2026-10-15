import { useCallback, useEffect, useRef } from "react";
import { AmbientMusic } from "./music";

/** Own one soundtrack per mounted game and retry blocked autoplay on real input. */
export function useAmbientMusic(active: boolean) {
  const music = useRef<AmbientMusic | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    // Create inside the effect so StrictMode teardown never reuses a destroyed track.
    const track = new AmbientMusic();
    music.current = track;
    const interaction = (event: Event) => {
      if (event.isTrusted && activeRef.current && !document.hidden)
        void track.play();
    };
    const visibility = () => {
      if (document.hidden) track.pause();
    };
    window.addEventListener("pointerdown", interaction, true);
    window.addEventListener("keydown", interaction, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", interaction, true);
      window.removeEventListener("keydown", interaction, true);
      document.removeEventListener("visibilitychange", visibility);
      music.current = null;
      track.destroy();
    };
  }, []);

  useEffect(() => {
    if (active && !document.hidden) void music.current?.play();
    else music.current?.pause();
  }, [active]);

  return useCallback(() => music.current?.pause(), []);
}
