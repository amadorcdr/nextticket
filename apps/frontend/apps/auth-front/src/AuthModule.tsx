import { Button, Icon, Link, Logo, Router, PrismaticBurst } from "@nextticket-frontend/commons";

export function AuthModule() {
  return (
    <div className="relative flex h-full w-full">
      <div className="absolute inset-0 z-0">
        <PrismaticBurst
          animationType="hover"
          intensity={2}
          speed={2}
          distort={0}
          paused={false}
          offset={{ x: 0, y: 0 }}
          hoverDampness={0.32}
          rayCount={0}
          colors={['#cc4cfa', '#00cfff', '#cc4cfa', '#ff0084', '#fca400', '#ffff00', '#00ff8a']}
        />
      </div>

      <div className="flex-1 p-4 z-10 relative flex items-center justify-center pointer-events-none">
        <Router.Outlet />
      </div>
    </div>
  );
}