import { Button, HeroParticles, HeroWaves, Icon, Logo, Router, ScrollShadow } from "@nextticket-frontend/commons";

export function Home() {
  const navigate = Router.useNavigate();

  return (
    <ScrollShadow className="relative flex h-full w-full p-2">
      <div className="relative w-full h-full">
        <HeroWaves />
        <HeroParticles />
        <div className="flex flex-col justify-center items-center gap-12 absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2">
          <h1 className="text-6xl text-center">
            De la emoción de tener tu entrada, a la euforia de estar ahí
          </h1>
          <div className="flex gap-2">
            <Button variant="tertiary" onPress={() => navigate("/eventos")}>
              Explorar eventos
              <Icon.ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center gap-4 absolute bg-background top-2 left-2 right-2 p-2 rounded-[10px]">
        <div className="flex gap-2 items-center">
          <Logo size={20} />
          <h4>Nextticket</h4>
        </div>
        <div className="flex gap-2 items-center">
          <Button onPress={() => navigate("/sign-in")}>
            Iniciar sesión
          </Button>
        </div>
      </div>
    </ScrollShadow>
  );
}
