/** Stars + faint U.S. map contour + flag-inspired light streaks */
const BackgroundFX = ({ className = "" }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
    {/* gradient lighting wash */}
    <div className="absolute -top-1/3 -left-1/4 h-[120%] w-[80%] rounded-full opacity-70 blur-3xl"
         style={{ background: "radial-gradient(closest-side, hsl(var(--usa-red) / 0.55), transparent 70%)" }} />
    <div className="absolute -bottom-1/3 -right-1/4 h-[120%] w-[80%] rounded-full opacity-70 blur-3xl"
         style={{ background: "radial-gradient(closest-side, hsl(var(--usa-blue) / 0.6), transparent 70%)" }} />

    {/* diagonal light streaks (flag-inspired) */}
    <div className="absolute inset-0 mix-blend-screen opacity-50"
         style={{
           background:
             "repeating-linear-gradient(115deg, transparent 0 80px, hsla(0,0%,100%,0.04) 80px 82px, transparent 82px 160px)"
         }} />

    {/* star field */}
    <svg className="absolute inset-0 h-full w-full opacity-60" aria-hidden="true">
      <defs>
        <pattern id="stars" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="20" r="0.8" fill="hsl(var(--white-soft))" />
          <circle cx="60" cy="50" r="0.5" fill="hsl(var(--white-soft))" opacity="0.7" />
          <circle cx="95" cy="90" r="0.9" fill="hsl(var(--white-soft))" />
          <circle cx="30" cy="100" r="0.4" fill="hsl(var(--white-soft))" opacity="0.6" />
          <circle cx="80" cy="15" r="0.6" fill="hsl(var(--white-soft))" opacity="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#stars)" />
    </svg>

    {/* faint U.S. map contour (stylized) */}
    <svg viewBox="0 0 800 400" className="absolute left-1/2 top-1/2 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]" aria-hidden="true">
      <path
        d="M60 180 C 90 140, 140 110, 200 120 C 260 100, 320 110, 380 130 C 440 110, 520 100, 600 120 C 680 130, 730 160, 740 200 C 730 230, 700 260, 640 270 L 600 290 L 540 280 L 500 310 L 440 300 L 400 320 L 340 310 L 280 320 L 220 300 L 160 290 L 110 260 C 70 240, 50 210, 60 180 Z"
        fill="none" stroke="hsl(var(--white-soft))" strokeWidth="2"
      />
    </svg>
  </div>
);
export default BackgroundFX;
