import { useEffect, useState } from "react";

import { motion } from "../design/tokens";
import type { ImportNotice } from "../music/types";

export function ImportNoticeStrip({ notices }: { notices: readonly ImportNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div data-testid="import-notices" className="shrink-0">
      {notices.map((notice, index) => (
        <div
          key={`${notice.kind}-${index}`}
          className="border-b border-amber-border-dim bg-amber-bg px-[22px] py-[9px] font-mono text-mono-meta text-amber-text-dim"
        >
          {notice.message}
        </div>
      ))}
    </div>
  );
}

/**
 * The audio context exists but the browser is not running it — iOS after a
 * screen lock or an interruption, or a tab that never got its gesture. Any tap
 * resumes it (see keepContextRunning), so the strip explains rather than acts.
 */
export function AudioBlockedNotice({ blocked }: { blocked: boolean }) {
  if (!blocked) return null;
  return (
    <div
      role="status"
      data-testid="audio-blocked-notice"
      className="shrink-0 border-b border-amber-border-dim bg-amber-bg px-[14px] py-[9px] font-mono text-mono-meta text-amber-text-dim md:px-[22px]"
    >
      Audio is paused by the browser — tap the screen to bring it back. On iPhone, check the
      side switch is not set to silent.
    </div>
  );
}

export interface TransientNoticeProps {
  message: string | null;
  onDismiss?: () => void;
}

export function TransientNotice({ message, onDismiss }: TransientNoticeProps) {
  const [visibility, setVisibility] = useState({ message, visible: Boolean(message) });

  if (visibility.message !== message) {
    setVisibility({ message, visible: Boolean(message) });
  }

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => {
      setVisibility((current) => ({ ...current, visible: false }));
      onDismiss?.();
    }, motion.noticeMs);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message || !visibility.visible) return null;
  return (
    <div
      role="status"
      className="shrink-0 border-t border-border-1 bg-notice-bg px-[22px] py-[10px] font-mono text-mono-meta text-amber-text-dim"
    >
      {message}
    </div>
  );
}
