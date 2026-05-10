const LogoMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="hsl(var(--usa-red))" />
        <stop offset="100%" stopColor="hsl(var(--usa-blue))" />
      </linearGradient>
    </defs>
    {/* geometric constellation star: 4-point star + ring */}
    <circle cx="20" cy="20" r="16" fill="none" stroke="url(#lm)" strokeWidth="1.2" opacity="0.55" />
    <path
      d="M20 4 L23 17 L36 20 L23 23 L20 36 L17 23 L4 20 L17 17 Z"
      fill="url(#lm)"
    />
    <circle cx="20" cy="20" r="2" fill="hsl(var(--gold))" />
  </svg>
);
export default LogoMark;
