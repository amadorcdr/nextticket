export type HeroWavesProps = {
  className?: string;
};

/*
 * Tres capas de olas SVG (mismo periodo de 1200 tileado x2 para loop continuo)
 * moviendose de izquierda a derecha a distinta velocidad, con la paleta del
 * RadiantBurst. Ocupan el tercio inferior del contenedor padre (relative).
 */
export function HeroWaves({ className = "" }: HeroWavesProps) {
  const backPath = "M0,70 C150,20 350,120 600,70 C850,20 1050,120 1200,70 L1200,200 L0,200 Z";
  const midPath = "M0,90 C200,40 400,140 600,90 C800,40 1000,140 1200,90 L1200,200 L0,200 Z";
  const frontPath = "M0,110 C180,150 420,60 600,100 C780,140 1020,60 1200,100 L1200,200 L0,200 Z";

  return (
    <div className={`absolute inset-x-0 bottom-0 h-1/3 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute bottom-0 left-0 h-full"
        style={{ width: "200%", animation: "hero-wave-move 20s linear infinite" }}
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
      >
        <path d={backPath} fill="#22d3ee" opacity="0.16" />
        <path d={backPath} fill="#22d3ee" opacity="0.16" transform="translate(1200,0)" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-full"
        style={{ width: "200%", animation: "hero-wave-move 14s linear infinite" }}
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
      >
        <path d={midPath} fill="#38bdf8" opacity="0.2" />
        <path d={midPath} fill="#38bdf8" opacity="0.2" transform="translate(1200,0)" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-full"
        style={{ width: "200%", animation: "hero-wave-move 9s linear infinite" }}
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
      >
        <path d={frontPath} fill="#a855f7" opacity="0.28" />
        <path d={frontPath} fill="#a855f7" opacity="0.28" transform="translate(1200,0)" />
      </svg>
    </div>
  );
}
