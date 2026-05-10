const NUM_SNOW = 60;
const snowParticles = Array.from({ length: NUM_SNOW }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 5,
  duration: 5 + Math.random() * 6,
  size: 2 + Math.random() * 4,
  opacity: 0.3 + Math.random() * 0.5,
  swayIdx: i % 5,
}));

const NUM_BLIZZARD = 150;
const blizzardParticles = Array.from({ length: NUM_BLIZZARD }).map((_, i) => ({
  id: i,
  x: Math.random() * 150 - 25, // Wider spread for angled fall
  delay: Math.random() * 2,
  duration: 0.6 + Math.random() * 0.5,
  size: 2 + Math.random() * 4,
}));

const NUM_RAIN = 120;
const rainParticles = Array.from({ length: NUM_RAIN }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 1,
  duration: 0.3 + Math.random() * 0.3,
  opacity: 0.4 + Math.random() * 0.5,
}));

const NUM_DRIZZLE = 80;
const drizzleParticles = Array.from({ length: NUM_DRIZZLE }).map((_, i) => ({
  id: i,
  x: Math.random() * 120 - 10,
  delay: Math.random() * 3,
  duration: 0.8 + Math.random() * 0.6,
}));

export const WeatherBackground = ({ city }: { city?: { name: string } | null }) => {
  const cityKey = city ? city.name.split(",")[0].trim().toLowerCase() : "";
  
  let weather = "sun";
  if (["san diego"].includes(cityKey)) {
    weather = "sun";
  } else if (["los angeles", "la"].includes(cityKey)) {
    weather = "sun";
  } else if (["tucson", "houston"].includes(cityKey)) {
    weather = "heatwave";
  } else if (["las vegas", "dallas"].includes(cityKey)) {
    weather = "extreme_sunny";
  } else if (["colorado springs", "colorado", "denver"].includes(cityKey)) {
    weather = "snow";
  } else if (["chicago", "new york", "new york city", "nyc"].includes(cityKey)) {
    weather = "blizzard";
  } else if (["atlanta", "charlotte", "birmingham"].includes(cityKey)) {
    weather = "humid_mist";
  } else if (["long beach", "portland", "seattle"].includes(cityKey)) {
    weather = "coastal_mist_drizzle";
  } else if (["miami"].includes(cityKey)) {
    weather = "thunderstorm";
  } else if (["san jose"].includes(cityKey)) {
    weather = "cloudy";
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-[0]">
      {weather === "sun" && (
        <div className="absolute inset-0 opacity-100 transition-opacity duration-1000 bg-gradient-to-br from-yellow-100/10 to-orange-100/5 mix-blend-overlay">
          <div
            className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, rgba(253,224,71,0.2) 0%, rgba(253,224,71,0) 70%)" }}
          />
        </div>
      )}

      {weather === "extreme_sunny" && (
        <div className="absolute inset-0 opacity-100 transition-opacity duration-1000 bg-gradient-to-br from-orange-400/20 to-yellow-300/10">
          <div
            className="absolute -top-[10%] -right-[10%] w-[80%] h-[80%] rounded-full blur-[140px] animate-[pulse_4s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, rgba(251,146,60,0.3) 0%, rgba(253,224,71,0) 70%)" }}
          />
           <div
            className="absolute bottom-[10%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite_1s]"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0) 70%)" }}
          />
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ background: "linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)", animation: "lens-flare 6s infinite" }} />
        </div>
      )}

      {weather === "heatwave" && (
        <div className="absolute inset-0 opacity-100 transition-opacity duration-1000 bg-gradient-to-b from-orange-500/10 to-amber-600/10 mix-blend-color-burn">
          <div className="absolute inset-0 opacity-[0.15]" 
               style={{ 
                 background: "repeating-linear-gradient(0deg, transparent, rgba(251,146,60,0.4) 8px, transparent 16px)",
                 animation: "heatwave_distortion 3s ease-in-out infinite alternate" 
               }} />
          <div
            className="absolute top-[50%] left-[50%] w-[120%] h-[120%] rounded-full blur-[140px] animate-[pulse_5s_ease-in-out_infinite]"
            style={{ transform: 'translate(-50%, -50%)', background: "radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0) 60%)" }}
          />
        </div>
      )}

      {weather === "snow" && (
        <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-gradient-to-b from-blue-900/20 to-cyan-800/10">
          {snowParticles.map((p) => (
            <div
              key={p.id}
              className="absolute top-[-10px] rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animation: `weather-fall ${p.duration}s linear infinite ${p.delay}s, weather-sway-${p.swayIdx} ${p.duration * 0.4}s ease-in-out infinite alternate ${p.delay}s`
              }}
            />
          ))}
          <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(255,255,255,0.1)] rounded-3xl" />
        </div>
      )}

      {weather === "blizzard" && (
        <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-slate-900/30">
          {blizzardParticles.map((p) => (
            <div
              key={p.id}
              className="absolute top-[-20px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size * 2,
                animation: `blizzard-fall ${p.duration}s linear infinite ${p.delay}s`
              }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
      )}

      {weather === "humid_mist" && (
        <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-emerald-900/10">
          <div className="absolute inset-0 opacity-50 mix-blend-screen"
               style={{ background: 'radial-gradient(circle at 50% 120%, rgba(150,255,200,0.15), transparent 70%)', filter: 'blur(30px)' }} />
          {[1,2,3].map(i => (
             <div key={i} className={`absolute left-[-10%] bg-white/5 blur-[40px] rounded-full`} 
                  style={{ 
                    width: '120%', height: '60%', top: `${(i-1)*30}%`,
                    animation: `fog-drift ${10 + i * 4}s ease-in-out infinite alternate ${i * 2}s` 
                  }} />
          ))}
        </div>
      )}

      {weather === "coastal_mist_drizzle" && (
         <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-slate-800/20">
            {drizzleParticles.map((p) => (
              <div
                key={p.id}
                className="absolute top-[-20px] bg-cyan-100/50"
                style={{ left: `${p.x}%`, width: "2px", height: "12px", animation: `drizzle-fall ${p.duration}s linear infinite ${p.delay}s` }}
              />
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-slate-300/10 to-transparent blur-2xl animate-[pulse_4s_infinite_alternate]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[120%] h-[70%] bg-white/5 blur-[50px] animate-[fog-drift_15s_linear_infinite_alternate]" />
         </div>
      )}

      {weather === "thunderstorm" && (
        <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-blue-950/40">
          <div className="absolute inset-0 bg-white opacity-0 animate-[lightning_6s_infinite]" />
          {rainParticles.map((p) => (
             <div
               key={p.id}
               className="absolute top-[-20px] bg-blue-100/60 shadow-[0_0_5px_rgba(219,234,254,0.5)]"
               style={{ left: `${p.x}%`, width: "2px", height: "20px", opacity: p.opacity, animation: `weather-fall ${p.duration}s linear infinite ${p.delay}s` }}
             />
          ))}
        </div>
      )}

      {weather === "cloudy" && (
        <div className="absolute inset-0 block opacity-100 transition-opacity duration-1000 bg-slate-400/10">
          <div className="absolute top-[10%] left-[-40%] w-[60%] h-[40%] bg-white/10 blur-[40px] rounded-full animate-[cloud-drift_25s_linear_infinite]" />
          <div className="absolute top-[40%] left-[-40%] w-[50%] h-[30%] bg-white/5 blur-[30px] rounded-full animate-[cloud-drift_30s_linear_infinite_5s]" />
          <div className="absolute top-[70%] left-[-40%] w-[70%] h-[30%] bg-white/10 blur-[50px] rounded-full animate-[cloud-drift_20s_linear_infinite_2s]" />
        </div>
      )}

      <style>{`
        @keyframes weather-fall {
          0% { transform: translateY(-5vh); }
          100% { transform: translateY(105vh); }
        }
        @keyframes blizzard-fall {
          0% { transform: rotate(-35deg) translateY(-20vh); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: rotate(-35deg) translateY(150vh); opacity: 0; }
        }
        @keyframes drizzle-fall {
          0% { transform: rotate(-15deg) translateY(-10vh); }
          100% { transform: rotate(-15deg) translateY(120vh); }
        }
        @keyframes weather-sway-0 { 0% { transform: translateX(0); } 100% { transform: translateX(12px); } }
        @keyframes weather-sway-1 { 0% { transform: translateX(0); } 100% { transform: translateX(-18px); } }
        @keyframes weather-sway-2 { 0% { transform: translateX(0); } 100% { transform: translateX(25px); } }
        @keyframes weather-sway-3 { 0% { transform: translateX(0); } 100% { transform: translateX(-15px); } }
        @keyframes weather-sway-4 { 0% { transform: translateX(0); } 100% { transform: translateX(30px); } }
        
        @keyframes heatwave {
          0% { transform: translateY(0); opacity: 0.3; }
          100% { transform: translateY(-15px); opacity: 0.7; }
        }
        @keyframes heatwave_distortion {
          0% { transform: translateY(0) scaleY(1); opacity: 0.1; }
          100% { transform: translateY(-10px) scaleY(1.05); opacity: 0.2; }
        }
        @keyframes lens-flare {
          0% { transform: translateX(-150%) skewX(-45deg); opacity: 0; }
          10% { opacity: 0.5; }
          20% { transform: translateX(250%) skewX(-45deg); opacity: 0; }
          100% { transform: translateX(250%) skewX(-45deg); opacity: 0; }
        }
        @keyframes lightning {
          0%, 93%, 98% { opacity: 0; }
          95%, 99% { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(180vw); }
        }
        @keyframes fog-drift {
          0% { transform: translateX(-5%); }
          100% { transform: translateX(5%); }
        }
      `}</style>
    </div>
  );
};
