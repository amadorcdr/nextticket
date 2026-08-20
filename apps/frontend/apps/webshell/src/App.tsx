import { useState, useCallback, useEffect, useMemo } from "react";
import { Breadcrumbs, Button, Icon, Router, Tooltip, Panel, useBreakpoint, ScrollShadow, Avatar, Tabs, Chip, Description, Badge, Label, ThemeSwitcher, TextField, Input, Logo, useApi, useSession } from "@nextticket-frontend/commons";

interface Crumb {
    label: string;
    onPress?: () => void;
}

/** Deriva las migas de pan del shell de Admin a partir de la ruta activa. */
function useAdminBreadcrumb(navigate: ReturnType<typeof Router.useNavigate>): Crumb[] {
    const location = Router.useLocation();
    const path = location.pathname;

    if (/^\/venues\/[^/]+\/canvas$/.test(path)) {
        return [
            { label: "Recintos", onPress: () => navigate("/venues") },
            { label: "Editar recinto", onPress: () => navigate(path.replace(/\/canvas$/, "/edit")) },
            { label: "Zonas" },
        ];
    }
    if (/^\/venues\/[^/]+\/edit$/.test(path)) {
        return [{ label: "Recintos", onPress: () => navigate("/venues") }, { label: "Editar recinto" }];
    }
    if (path === "/venues/canvas") {
        return [{ label: "Recintos", onPress: () => navigate("/venues") }, { label: "Crear recinto" }];
    }
    if (path.startsWith("/venues")) {
        return [{ label: "Recintos" }];
    }
    if (path.startsWith("/tickets/")) {
        return [{ label: "Eventos", onPress: () => navigate("/events") }, { label: "Ventas" }];
    }
    if (path.startsWith("/events")) {
        return [{ label: "Eventos" }];
    }
    if (path === "/users/new") {
        return [{ label: "Usuarios", onPress: () => navigate("/users") }, { label: "Crear usuario" }];
    }
    if (/^\/users\/[^/]+\/edit$/.test(path)) {
        return [{ label: "Usuarios", onPress: () => navigate("/users") }, { label: "Editar usuario" }];
    }
    if (path.startsWith("/users")) {
        return [{ label: "Usuarios" }];
    }
    if (path.startsWith("/purchases")) {
        return [{ label: "Compras" }];
    }
    if (path === "/profile") {
        return [{ label: "Perfil" }];
    }
    return [{ label: "Dashboard" }];
}

const NAV_LINKS = [
    { to: "/dashboard", icon: Icon.LayoutDashboard, label: "Dashboard" },
    { to: "/users", icon: Icon.Users, label: "Usuarios", count: undefined as number | undefined },
    { to: "/venues", icon: Icon.Home, label: "Recintos", count: undefined as number | undefined },
    { to: "/events", icon: Icon.Calendar, label: "Eventos", count: undefined as number | undefined },
];

export function App() {
    const isDesktop = useBreakpoint(1024);

    const [sidebarVisible, setSidebarVisible] = useState(true);

    const toggleSidebar = useCallback(() => {
        setSidebarVisible((v) => !v);
    }, []);

    const location = Router.useLocation();
    const navigate = Router.useNavigate();
    const { signOut } = useSession();
    const api = useApi();

    const handleSignOut = () => {
        // Navega primero a una ruta pública y limpia la sesión después: si se
        // hace al revés, el guard de esta misma ruta puede alcanzar a
        // reaccionar al cambio de sesión antes de que el navigate surta
        // efecto, y termina mandando a /sign-in en vez de a la landing.
        navigate("/", { replace: true });
        setTimeout(signOut, 0);
    };

    const [usersCount, setUsersCount] = useState<number | undefined>(undefined);
    const [venuesCount, setVenuesCount] = useState<number | undefined>(undefined);
    const [eventsCount, setEventsCount] = useState<number | undefined>(undefined);

    useEffect(() => {
        api
            .get<{ meta: { total: number } }>("/users?page=1&limit=1")
            .then((res) => setUsersCount(res.meta.total))
            .catch(() => {
                // Si falla, el chip de Usuarios simplemente no se muestra.
            });
        api
            .get<{ meta: { total: number } }>("/venues?page=1&limit=1")
            .then((res) => setVenuesCount(res.meta.total))
            .catch(() => {
                // Si falla, el chip de Recintos simplemente no se muestra.
            });
        api
            .get<{ meta: { total: number } }>("/events?page=1&limit=1")
            .then((res) => setEventsCount(res.meta.total))
            .catch(() => {
                // Si falla, el chip de Eventos simplemente no se muestra.
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const navLinks = useMemo(
        () =>
            NAV_LINKS.map((link) => {
                if (link.to === "/users") return { ...link, count: usersCount };
                if (link.to === "/venues") return { ...link, count: venuesCount };
                if (link.to === "/events") return { ...link, count: eventsCount };
                return link;
            }),
        [usersCount, venuesCount, eventsCount],
    );

    const activeNavKey = navLinks.find(link => location.pathname.startsWith(link.to))?.to || "none";
    const breadcrumb = useAdminBreadcrumb(navigate);

    const navContent = (
        <>
            <div className="py-4 flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
                <div className="px-4 flex items-center gap-2 shrink-0 text-accent">
                    <Logo size={20} />
                    <h4>Nextticket</h4>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                    <Description className="px-4">Navegación</Description>
                    <Tabs
                        aria-label="Navegación principal"
                        variant="secondary"
                        orientation="vertical"
                        selectedKey={activeNavKey}
                    >
                        <Tabs.ListContainer className="border-none w-full">
                            <Tabs.List className="w-full">
                                {navLinks.map(({ to, icon: NavIcon, label, count }) => (
                                    <Tabs.Tab
                                        key={to}
                                        id={to}
                                        href={to}
                                        className="flex justify-between w-full"
                                        render={({ href, ...domProps }: any) => <Router.Link to={href} {...domProps} />}
                                    >
                                        <div className="flex items-center gap-2">
                                            <NavIcon className="size-4" />
                                            <span>{label}</span>
                                        </div>
                                        {count !== undefined && (
                                            <Chip variant="soft" color="default">
                                                {count}
                                            </Chip>
                                        )}
                                        <Tabs.Indicator className="rounded-full" />
                                    </Tabs.Tab>
                                ))}
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                </div>
            </div>
            <div className="flex flex-col gap-2 p-4 shrink-0">
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

    return (
        <div className="flex h-full w-full relative p-2">
            <Panel
                isOpen={sidebarVisible}
                onOpenChange={setSidebarVisible}
                isDrawer={!isDesktop}
                placement="left"
                margin={16}
            >
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    {navContent}
                </div>
            </Panel>

            <div className="flex flex-col flex-1 min-w-0 gap-4 rounded-[10px]">
                <div className="flex items-center justify-between gap-4 shrink-0 md:p-2">
                    <div className="flex-1 flex items-center md:gap-2 gap-1 min-w-0">
                        <Tooltip>
                            <Tooltip.Trigger>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={toggleSidebar}
                                >
                                    {sidebarVisible
                                        ? <Icon.PanelRightOpen />
                                        : <Icon.PanelLeftOpen />
                                    }
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>{sidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar"}</Tooltip.Content>
                        </Tooltip>
                        <ScrollShadow className="flex-1 min-w-0" orientation="horizontal" hideScrollBar size={16}>
                            <Breadcrumbs>
                                <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
                                {breadcrumb.map((crumb, index) => (
                                    <Breadcrumbs.Item key={index} onPress={crumb.onPress}>
                                        {crumb.label}
                                    </Breadcrumbs.Item>
                                ))}
                            </Breadcrumbs>
                        </ScrollShadow>
                    </div>
                    <div className="flex items-center md:gap-2 gap-1 shrink-0">
                        <Tooltip>
                            <Tooltip.Trigger>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={() => navigate("/profile")}
                                >
                                    <Icon.User />
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Perfil</Tooltip.Content>
                        </Tooltip>
                    </div>
                </div>

                <ScrollShadow className="flex-1 overflow-auto relative">
                    <Router.Outlet />
                </ScrollShadow>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden absolute inset-x-0 bottom-0 p-4 z-50 pointer-events-none flex justify-center">
                <ScrollShadow orientation="horizontal" className="px-2 flex bg-surface shadow-overlay rounded-[10px] pointer-events-auto  max-w-full">
                    <Tabs
                        aria-label="Navegación principal móvil"
                        variant="secondary"
                        orientation="horizontal"
                        selectedKey={activeNavKey}
                    >
                        <Tabs.ListContainer className="border-none">
                            <Tabs.List>
                                {navLinks.map(({ to, icon: NavIcon, label, count }) => (
                                    <Tabs.Tab
                                        key={to}
                                        id={to}
                                        href={to}
                                        className="flex gap-2 h-fit w-16 pt-4 pb-2"
                                        render={({ href, ...domProps }: any) => <Router.Link to={href} {...domProps} />}
                                    >
                                        <Badge.Anchor>

                                            <div className="flex flex-col items-center gap-2">
                                                <NavIcon className="size-4" />
                                                <span className="text-xs">{label}</span>
                                            </div>
                                            {count !== undefined && (
                                                <Badge variant="soft" size="sm" color="default">
                                                    {count}
                                                </Badge>
                                            )}
                                        </Badge.Anchor>

                                        <Tabs.Indicator className="rounded-full" />
                                    </Tabs.Tab>
                                ))}
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                </ScrollShadow>
            </div>
        </div>
    );
}