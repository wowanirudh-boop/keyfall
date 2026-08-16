import { Link } from "react-router-dom";

import { GHOST_BUTTON_CLASS_NAME } from "./primitives";

export function RouteShell({
  label,
  title,
  homeLink = false,
}: {
  label: string;
  title: string;
  homeLink?: boolean;
}) {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-[32px] py-[40px]">
      <section className="flex w-full max-w-[880px] flex-col items-start rounded-card border border-border-2 bg-card p-[26px]">
        <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">
          {label}
        </span>
        <h1 className="mt-[8px] text-subheading font-medium">{title}</h1>
        {homeLink ? (
          <Link className={`${GHOST_BUTTON_CLASS_NAME} mt-[18px]`} to="/">
            ← Home
          </Link>
        ) : null}
      </section>
    </main>
  );
}

export function MissingRecord({ title }: { title: string }) {
  return <RouteShell label="Not found" title={title} homeLink />;
}
