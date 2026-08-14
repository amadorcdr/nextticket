export type HeroParticlesProps = {
  className?: string;
};

type Particle = {
  left: string;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rise: number;
};

// Posiciones/tiempos fijos (no random) para que no cambien en cada render.
const PARTICLES: Particle[] = [
  { left: "4%", size: 3, color: "#a855f7", duration: 12, delay: -1, rise: 220 },
  { left: "11%", size: 2, color: "#38bdf8", duration: 15, delay: -7, rise: 280 },
  { left: "19%", size: 3, color: "#22d3ee", duration: 10, delay: -3, rise: 190 },
  { left: "27%", size: 2, color: "#a855f7", duration: 17, delay: -10, rise: 320 },
  { left: "35%", size: 4, color: "#38bdf8", duration: 13, delay: -5, rise: 240 },
  { left: "43%", size: 2, color: "#22d3ee", duration: 16, delay: -2, rise: 300 },
  { left: "51%", size: 3, color: "#a855f7", duration: 11, delay: -8, rise: 210 },
  { left: "59%", size: 2, color: "#38bdf8", duration: 14, delay: -4, rise: 260 },
  { left: "67%", size: 4, color: "#22d3ee", duration: 18, delay: -11, rise: 330 },
  { left: "74%", size: 2, color: "#a855f7", duration: 12, delay: -6, rise: 200 },
  { left: "82%", size: 3, color: "#38bdf8", duration: 15, delay: -9, rise: 290 },
  { left: "90%", size: 2, color: "#22d3ee", duration: 13, delay: -3, rise: 230 },
  { left: "96%", size: 3, color: "#a855f7", duration: 16, delay: -12, rise: 310 },
  { left: "23%", size: 2, color: "#38bdf8", duration: 19, delay: -7, rise: 340 },
  { left: "63%", size: 3, color: "#22d3ee", duration: 11, delay: -1, rise: 205 },
  { left: "87%", size: 2, color: "#a855f7", duration: 14, delay: -5, rise: 255 },
];

export function HeroParticles({ className = "" }: HeroParticlesProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-1/3 rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animation: `hero-particle-float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            ["--rise" as string]: `${p.rise}px`,
          }}
        />
      ))}
    </div>
  );
}
