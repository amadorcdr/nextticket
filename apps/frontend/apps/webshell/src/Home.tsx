import { Button, Icon, Logo, PrismaticBurst, ScrollShadow } from "@nextticket-frontend/commons";

export function Home() {
  return (
    <ScrollShadow className="relative flex h-full w-full p-2">
      <div className="relative w-full h-160">
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
        <div className="flex flex-col justify-center items-center gap-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex gap-2 items-center">
            <Logo size={20} />
            <h4>Nextticket</h4>
          </div>
          <h1 className="text-6xl text-center ">
            De la emoción de tener tu entrada, a la euforia de estar ahí
          </h1>
          <div className="flex gap-2">
            <Button variant="tertiary">
              Registrarse
              <Icon.ChevronRight />
            </Button>
            <Button>
              Explorar eventos
              <Icon.ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center gap-4 absolute bg-surface top-2 left-2 right-2 p-2 rounded-[10px]">
        <div className="flex gap-2 items-center">
          <Logo size={20} />
          <h4>Nextticket</h4>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="tertiary">
            Registrarse
          </Button>
          <Button>
            Iniciar sesión
          </Button>
        </div>
      </div>
    </ScrollShadow>
  );
}
