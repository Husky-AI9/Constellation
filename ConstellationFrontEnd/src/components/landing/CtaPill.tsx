type Props = { onClick?: () => void; children: React.ReactNode };

const CtaPill = ({ onClick, children }: Props) => (
  <button
    onClick={onClick}
    className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-7 py-4 font-display text-sm font-semibold uppercase tracking-[0.18em] text-white-soft transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-glow-red"
    style={{ background: "var(--gradient-cta)" }}
  >
    {/* sweep */}
    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,hsla(0,0%,100%,0.35),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
    <span className="relative">{children}</span>
    <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-white-soft/15 transition-transform duration-300 group-hover:translate-x-1">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  </button>
);
export default CtaPill;
