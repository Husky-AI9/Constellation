const InsetPreviewCard = ({ onPlay }: { onPlay?: () => void }) => (
  <button
    onClick={onPlay}
    className="glass-strong group flex items-center gap-3 rounded-2xl p-2 pr-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label="Play Phoenix demo preview"
  >
    {/* mini visual */}
    <div className="relative h-14 w-20 overflow-hidden rounded-xl"
         style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white-soft text-navy transition-transform duration-300 group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </div>
    <div className="leading-tight">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Preview</div>
      <div className="font-display text-sm font-semibold text-white-soft">Phoenix Demo</div>
    </div>
  </button>
);
export default InsetPreviewCard;
