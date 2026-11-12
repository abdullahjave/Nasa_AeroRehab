import { NAV_ITEMS } from "@/lib/nav";

export default function PagePlaceholder({ href }: { href: string }) {
  const item = NAV_ITEMS.find((n) => n.href === href)!;
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[13px] uppercase tracking-[0.2em] text-cyan-300/70">AeroRehab</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{item.label}</h1>
        <p className="mt-1 text-sm text-slate-300">{item.blurb}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {["Primary panel", "Secondary panel", "Status panel"].map((t) => (
          <section key={t} className="glass rounded-lg p-4">
            <h2 className="text-sm font-medium text-white">{t}</h2>
            <p className="mt-2 text-xs text-slate-400">Placeholder. Content arrives in a later step.</p>
            <div className="mt-3 h-16 rounded border border-dashed border-cyan-400/20" />
          </section>
        ))}
      </div>
    </div>
  );
}
