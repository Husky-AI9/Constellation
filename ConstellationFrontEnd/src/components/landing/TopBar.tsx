import LogoMark from "./LogoMark";

const TopBar = () => (
  <header className="flex items-start justify-between gap-6 px-6 pt-6 md:px-10 md:pt-8">
    {/* Left: logo + brand */}
    <div className="flex items-center gap-3">
      <LogoMark className="h-9 w-9" />
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-tight text-white-soft">
          Team USA Constellation
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Gemini × Google Cloud
        </div>
      </div>
    </div>

    {/* Center: minimal × glyph */}
    <div className="hidden md:flex items-center justify-center text-white-soft/60">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </div>

    {/* Right: caption */}
    <div className="hidden max-w-[260px] text-right text-[11px] leading-snug text-muted-foreground md:block">
      <span className="text-white-soft/85">A Gemini-powered fan experience</span>
      <br />
      connecting hometowns, Olympic + Paralympic
      <br />
      stories, and LA28 momentum into one journey.
    </div>
  </header>
);
export default TopBar;
