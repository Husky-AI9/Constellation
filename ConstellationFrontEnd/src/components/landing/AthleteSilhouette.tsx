/** Abstract, non-identifiable athlete in motion — pure SVG. */
const AthleteSilhouette = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 400 500" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="hsl(var(--white-soft))" stopOpacity="0.95" />
        <stop offset="60%" stopColor="hsl(var(--silver))" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(var(--usa-blue))" stopOpacity="0.4" />
      </linearGradient>
      <radialGradient id="rim" cx="0.7" cy="0.3" r="0.8">
        <stop offset="0%" stopColor="hsl(var(--usa-red))" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(var(--usa-red))" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* rim light */}
    <ellipse cx="280" cy="160" rx="180" ry="220" fill="url(#rim)" />

    {/* abstract running/leaning athletic figure built from organic shapes */}
    <g fill="url(#bodyGrad)">
      {/* head */}
      <circle cx="210" cy="120" r="42" />
      {/* torso */}
      <path d="M170 150 C 150 200, 150 280, 200 320 L 260 320 C 290 270, 290 200, 260 150 Z" />
      {/* front arm extended */}
      <path d="M260 175 C 310 180, 350 210, 360 260 L 340 270 C 320 235, 290 215, 255 210 Z" />
      {/* back arm */}
      <path d="M170 180 C 130 200, 110 240, 120 290 L 145 285 C 140 250, 155 220, 180 210 Z" />
      {/* leg forward */}
      <path d="M210 320 C 215 380, 230 430, 250 470 L 280 460 C 270 420, 260 370, 260 320 Z" />
      {/* leg back, lifted */}
      <path d="M200 320 C 180 360, 150 380, 110 380 L 110 405 C 160 410, 200 390, 220 360 Z" />
    </g>

    {/* highlight strokes */}
    <g fill="none" stroke="hsl(var(--white-soft))" strokeOpacity="0.7" strokeWidth="2">
      <path d="M250 90 C 270 110, 270 140, 250 160" />
      <path d="M200 200 C 220 230, 230 270, 220 310" />
    </g>
  </svg>
);
export default AthleteSilhouette;
