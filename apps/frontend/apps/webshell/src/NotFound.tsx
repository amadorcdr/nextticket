import { Router, Button, Icon } from "@nextticket-frontend/commons";

export function NotFound() {
    const location = Router.useLocation();
    const navigate = Router.useNavigate();

    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Elementos decorativos de fondo */}
            <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/40 rounded-full blur-3xl mix-blend-screen" />
                <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-secondary/30 rounded-full blur-3xl mix-blend-screen" />
            </div>

            <div className="z-10 flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-9xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-sm mb-4">
                    404
                </h1>
                
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    Página no encontrada
                </h2>
                
                <p className="text-default-500 max-w-md text-lg mb-8">
                    Lo sentimos, la ruta <code className="px-2 py-1 bg-default-100 rounded-md text-danger font-mono font-medium">{location.pathname}</code> no existe en nuestros registros o ha sido movida.
                </p>

                <div className="flex gap-4">
                    <Button 
                        size="lg"
                        color="primary"
                        onPress={() => navigate(-1)}
                    >
                        Regresar
                    </Button>
                    <Button 
                        size="lg"
                        variant="flat"
                        onPress={() => navigate("/dashboard")}
                    >
                        Ir al Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}
