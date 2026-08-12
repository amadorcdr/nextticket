import { useState, type ReactNode } from "react";
import {
    Breadcrumbs,
    Button,
    Chip,
    Description,
    Icon,
    Logo,
    Panel,
    ProfileModal,
    Router,
    ScrollShadow,
    Tabs,
    Tooltip,
    useBreakpoint,
    useSession,
} from "@nextticket-frontend/commons";
import { VALIDATOR_EVENTS } from "../mocks/validatorEvents";

/** Navegación exclusiva del rol Validador: únicamente "Eventos". */
function ValidatorNav() {
    const navigate = Router.useNavigate();
    const { signOut } = useSession();

    const handleSignOut = () => {
        // Navega primero a una ruta pública y limpia la sesión después: así el
        // guard de esta ruta no alcanza a redirigir a /sign-in antes de salir.
        navigate("/", { replace: true });
        setTimeout(signOut, 0);
    };

    return (
        <>
            <div className="py-4 flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
                <div className="px-4 flex items-center gap-2 shrink-0 text-accent">
                    <Logo size={20} />
                    <h4>Nextticket</h4>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                    <Description className="px-4">Navegación</Description>
                    <Tabs
                        aria-label="Navegación del validador"
                        variant="secondary"
                        orientation="vertical"
                        selectedKey="/validator"
                    >
                        <Tabs.ListContainer className="border-none w-full">
                            <Tabs.List className="w-full">
                                <Tabs.Tab
                                    id="/validator"
                                    href="/validator"
                                    className="flex justify-between w-full"
                                    render={({ href, ...domProps }: any) => (
                                        <Router.Link to={href} {...domProps} />
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon.Calendar className="size-4" />
                                        <span>Eventos</span>
                                    </div>
                                    <Chip variant="soft" color="default">
                                        {VALIDATOR_EVENTS.length}
                                    </Chip>
                                    <Tabs.Indicator className="rounded-full" />
                                </Tabs.Tab>
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
                <div className="rounded-[10px] bg-surface-secondary p-3 flex gap-3">
                    <Icon.Info className="size-4 shrink-0 mt-0.5 text-muted" />
                    <p className="text-xs text-muted">
                        Modo demostración: los eventos y boletos son datos simulados.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
                >
                    <Icon.LogOut className="size-4" />
                    Cerrar sesión
                </button>
            </div>
        </>
    );
}

export function ValidatorLayout({ children }: { children: ReactNode }) {
    const isDesktop = useBreakpoint(1024);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);

    const location = Router.useLocation();
    const navigate = Router.useNavigate();

    const isValidationRoute = location.pathname.includes("/validate");

    return (
        <div className="flex h-full w-full relative p-2">
            <Panel
                isOpen={sidebarVisible}
                onOpenChange={setSidebarVisible}
                isDrawer={!isDesktop}
                placement="left"
            >
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    <ValidatorNav />
                </div>
            </Panel>

            <div className="flex flex-col flex-1 min-w-0 gap-4 md:p-2 shadow-surface rounded-[10px]">
                <div className="flex items-center justify-between gap-4 shrink-0">
                    <div className="flex-1 flex items-center md:gap-2 gap-1 min-w-0">
                        <Tooltip>
                            <Tooltip.Trigger>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={() => setSidebarVisible((visible) => !visible)}
                                >
                                    {sidebarVisible ? <Icon.PanelRightOpen /> : <Icon.PanelLeftOpen />}
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                                {sidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar"}
                            </Tooltip.Content>
                        </Tooltip>

                        <ScrollShadow
                            className="flex-1 min-w-0"
                            orientation="horizontal"
                            hideScrollBar
                            size={16}
                        >
                            <Breadcrumbs>
                                <Breadcrumbs.Item>Validador</Breadcrumbs.Item>
                                <Breadcrumbs.Item
                                    onPress={
                                        isValidationRoute
                                            ? () => navigate("/validator")
                                            : undefined
                                    }
                                >
                                    Eventos
                                </Breadcrumbs.Item>
                                {isValidationRoute ? (
                                    <Breadcrumbs.Item>Validación</Breadcrumbs.Item>
                                ) : null}
                            </Breadcrumbs>
                        </ScrollShadow>
                    </div>

                    <Tooltip>
                        <Tooltip.Trigger>
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                onPress={() => setProfileOpen(true)}
                            >
                                <Icon.User />
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Perfil</Tooltip.Content>
                    </Tooltip>
                </div>

                <ScrollShadow className="flex-1 overflow-auto relative px-2 pb-2">
                    {children}
                </ScrollShadow>
            </div>

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
        </div>
    );
}
