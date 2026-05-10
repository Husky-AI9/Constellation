type Props = { value: string; label: string; tone?: "red" | "blue" };

const RingStatCard = ({ value, label, tone = "blue" }: Props) => {
  const stroke = tone === "red" ? "hsl(var(--usa-red))" : "hsl(var(--usa-blue))";
  // arc length for a nice partial ring
  const C = 2 * Math.PI * 42;
  const dash = C * 0.78;
  return (
    <div className="glass-strong group relative h-[140px] w-[140px] rounded-full p-3 transition-transform duration-500 hover:-translate-y-1">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="hsla(0,0%,100%,0.08)" strokeWidth="3" />
        <circle
          cx="50" cy="50" r="42" fill="none" stroke={stroke} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
          style={{ filter: `drop-shadow(0 0 8px ${stroke})` }}
        />
      </svg>
      <div className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <div className="font-display text-2xl font-semibold text-white-soft">{value}</div>
        <div className="mt-1 max-w-[90px] text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
};
export default RingStatCard;
