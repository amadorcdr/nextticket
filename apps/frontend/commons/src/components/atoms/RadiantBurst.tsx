export type RadiantBurstProps = {
  className?: string;
};

/*
 * Alternativa a PrismaticBurst sin WebGL: gradientes conicos rotando con CSS.
 * Al ser vectorial (sin ruido por pixel ni raymarching) siempre se ve nitido,
 * sin importar el devicePixelRatio de la pantalla.
 */
export function RadiantBurst({ className = "" }: RadiantBurstProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-[10px] pointer-events-none ${className}`}
    >
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2 animate-[spin_26s_linear_infinite]"
        style={{
          backgroundImage:
            "repeating-conic-gradient(from 0deg, #a855f7 0deg 4deg, transparent 4deg 30deg, #38bdf8 30deg 34deg, transparent 34deg 60deg, #7c3aed 60deg 64deg, transparent 64deg 90deg, #0ea5e9 90deg 94deg, transparent 94deg 120deg)",
          opacity: 0.85,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 animate-[spin_34s_linear_infinite_reverse]"
        style={{
          backgroundImage:
            "repeating-conic-gradient(from 15deg, #6d28d9 0deg 3deg, transparent 3deg 45deg, #22d3ee 45deg 48deg, transparent 48deg 90deg)",
          opacity: 0.55,
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.85) 0%, rgba(56,189,248,0.35) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 0%, transparent 45%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
