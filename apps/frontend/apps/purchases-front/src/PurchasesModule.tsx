import { Button, PrismaticBurst } from "@nextticket-frontend/commons"

export function PurchasesModule() {
  return (
    <div className="flex-1 relative w-full h-full">
      <PrismaticBurst
        animationType="rotate3d"
        intensity={2}
        speed={0.5}
        distort={0}
        paused={false}
        offset={{ x: 0, y: 0 }}
        hoverDampness={0.25}
        rayCount={0}
        mixBlendMode="lighten"
        colors={['#A855F7', '#7C3AED', '#6366F1']}
      />
    </div>
  );
}
