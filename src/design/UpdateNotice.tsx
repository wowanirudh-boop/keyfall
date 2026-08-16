import { GhostButton, StatusBanner } from './primitives';

export interface UpdateNoticeProps {
  onDismiss: () => void;
  onReload: () => void;
}

export function UpdateNotice({ onDismiss, onReload }: UpdateNoticeProps) {
  return (
    <StatusBanner
      data-testid="update-notice"
      className="fixed inset-x-[12px] top-[12px] z-50 mx-auto max-w-[520px] items-center"
    >
      <span className="min-w-0 flex-1 font-mono text-mono-meta">A new version is ready.</span>
      <div className="flex shrink-0 items-center gap-[8px]">
        <GhostButton className="font-mono" onClick={onReload}>
          Reload
        </GhostButton>
        <GhostButton
          aria-label="Dismiss update notice"
          className="px-[10px] font-mono"
          onClick={onDismiss}
        >
          ×
        </GhostButton>
      </div>
    </StatusBanner>
  );
}
