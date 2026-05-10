import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

import PillTag from "@/components/landing/PillTag";
import HeroCard from "@/components/landing/HeroCard";
import RingStatCard from "@/components/landing/RingStatCard";
import BigWordmark from "@/components/landing/BigWordmark";
import GhostWordmark from "@/components/landing/GhostWordmark";
import CtaPill from "@/components/landing/CtaPill";

const Index = () => {
  const navigate = useNavigate();
  const handleStartJourney = () => navigate("/hub");
  const handleTryDemo = () => navigate("/hub");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* ambient page glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/3 h-[600px] w-[600px] rounded-full opacity-40 blur-[120px]"
        style={{ background: "hsl(var(--usa-red) / 0.45)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-0 h-[700px] w-[700px] rounded-full opacity-40 blur-[140px]"
        style={{ background: "hsl(var(--usa-blue) / 0.5)" }}
      />

      <div className="relative z-10 flex h-full flex-col">

        {/* Main composition area */}
        <div className="relative grid flex-1 grid-cols-12 grid-rows-6 gap-4 px-6 pb-4 pt-4 md:px-10 md:pb-6 md:pt-6">
          {/* Pill tag — top-left of composition */}
          <div className="col-span-12 row-span-1 flex items-start animate-rise" style={{ animationDelay: "120ms" }}>
            <PillTag>Fan Experience</PillTag>
          </div>

          {/* Hero card — dominant left/center */}
          <div className="col-span-12 row-span-4 lg:col-span-9 animate-rise" style={{ animationDelay: "220ms" }}>
            <HeroCard onTryDemo={handleTryDemo} />
          </div>

          {/* Right column — two stacked ring cards */}
          <div className="hidden lg:col-span-3 lg:row-span-4 lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-6">
            <div className="animate-rise animate-float" style={{ animationDelay: "320ms" }}>
              <RingStatCard value="50/50" label="Olympic + Paralympic Parity" tone="red" />
            </div>
            <div className="animate-rise animate-float-2" style={{ animationDelay: "420ms" }}>
              <RingStatCard value="100%" label="Aggregate Public Data" tone="blue" />
            </div>
          </div>

          {/* Bottom row: wordmark left + CTA right */}
          <div className="col-span-12 row-span-1 flex flex-col items-start justify-end gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="animate-rise" style={{ animationDelay: "520ms" }}>
              <BigWordmark />
            </div>
            <div className="flex flex-col items-end gap-2 animate-rise" style={{ animationDelay: "620ms" }}>
              <CtaPill onClick={handleStartJourney}>Start My Journey</CtaPill>
              <button
                onClick={handleTryDemo}
                className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 transition-colors hover:text-white-soft hover:underline"
              >
                Explore the live hub →
              </button>
            </div>
          </div>
        </div>

        {/* Ghost wordmark bleeding off the bottom edge */}
        <div className="pointer-events-none absolute -bottom-6 left-0 right-0 overflow-hidden">
          <div className="px-6 md:px-10">
            <GhostWordmark />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
