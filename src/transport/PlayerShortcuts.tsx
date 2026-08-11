import { useEffect, useRef } from "react";

export interface PlayerShortcutsProps {
  position: number;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
}

function isTextInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

export function PlayerShortcuts({
  position,
  onTogglePlay,
  onSeek,
}: PlayerShortcutsProps) {
  const actions = useRef({ position, onTogglePlay, onSeek });

  useEffect(() => {
    actions.current = { position, onTogglePlay, onSeek };
  }, [onSeek, onTogglePlay, position]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        actions.current.onTogglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        actions.current.onSeek(actions.current.position - 5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        actions.current.onSeek(actions.current.position + 5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
