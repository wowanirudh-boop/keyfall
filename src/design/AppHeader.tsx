import type { ReactNode } from "react";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="flex items-baseline justify-between gap-[16px]">
      <div className="flex items-baseline gap-[12px]">
        <span aria-hidden="true" className="h-[10px] w-[10px] shrink-0 rounded-[50%] bg-hand-right" />
        <span className="text-title font-bold tracking-[-0.01em]">Piano Practice Player</span>
      </div>
      {action}
    </header>
  );
}
