import AthleteSilhouette from "./AthleteSilhouette";
import BackgroundFX from "./BackgroundFX";
import InsetPreviewCard from "./InsetPreviewCard";

const HeroCard = ({ onTryDemo }: { onTryDemo?: () => void }) => (
  <div className="relative h-full w-full overflow-hidden rounded-[32px] shadow-card"
       style={{ background: "linear-gradient(135deg, hsl(var(--deep-blue)) 0%, hsl(224 60% 10%) 100%)" }}>
    <BackgroundFX />

    {/* athlete */}
    <div className="absolute inset-0 flex items-end justify-center">
      <AthleteSilhouette className="h-[92%] w-auto translate-y-2 drop-shadow-[0_20px_40px_hsl(var(--usa-red)/0.35)]" />
    </div>

    {/* top-right tiny meta */}
    <div className="absolute right-5 top-5 text-right text-[10px] uppercase tracking-[0.22em] text-white-soft/70">
      Olympic + Paralympic<br />parity by design
    </div>

    {/* inset preview card bottom-left, overlapping */}
    <div className="absolute bottom-5 left-5 animate-float">
      <InsetPreviewCard onPlay={onTryDemo} />
    </div>

    {/* glossy edge */}
    <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/10" />
  </div>
);
export default HeroCard;
