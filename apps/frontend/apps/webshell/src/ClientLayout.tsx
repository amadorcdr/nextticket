import {
    Breadcrumbs,
    Button,
    Chip,
    Dropdown,
    getInitials,
    Icon,
    Logo,
    Router,
    ScrollShadow,
    Tabs,
    Tooltip,
    useCart,
    useSession,
} from "@nextticket-frontend/commons";

/*
 * Shell del cliente. Es aparte del de organizador (App.tsx) a proposito:
 * el cliente no administra recintos ni usuarios, solo navega el catalogo,
 * compra y consulta sus boletos.
 */
const CLIENT_LINKS = [
    { to: "/eventos", icon: Icon.Calendar, label: "Eventos" },
    { to: "/mis-boletos", icon: Icon.Ticket, label: "Mis boletos" },
    { to: "/mis-compras", icon: Icon.ReceiptText, label: "Mis compras" },
];

export function ClientLayout() {
    const location = Router.useLocation();
    const navigate = Router.useNavigate();
    const { user, isAuthenticated, signOut } = useSession();
    const { seats } = useCart();
    const isProfileRoute = location.pathname === "/perfil";

    // "Mis boletos"/"Mis compras" solo tienen sentido para quien ya inició
    // sesión como cliente: sin sesión, o con otro rol, no hay nada propio
    // que consultar en esas rutas.
    const isClient = isAuthenticated && user?.role === "usuario";
    const visibleLinks = CLIENT_LINKS.filter(
        (link) => (link.to !== "/mis-boletos" && link.to !== "/mis-compras") || isClient,
    );

    const activeKey =
        visibleLinks.find((link) => location.pathname.startsWith(link.to))?.to ??
        "none";

    const handleSignOut = () => {
        // Navega primero a una ruta pública y limpia la sesión después: si se
        // hace desde una ruta protegida (ej. /mis-boletos), el guard puede
        // reaccionar al cambio de sesión antes de que el navigate surta
        // efecto, y termina mandando a /sign-in en vez de a la landing.
        navigate("/", { replace: true });
        setTimeout(signOut, 0);
    };

    return (
        <div className="flex flex-col h-full w-full relative p-2 gap-2">
            <header className="flex items-center justify-between gap-4 shrink-0 px-2">
                {/* Con sesión activa no hay a dónde "salir": la landing solo se
                    vuelve a ver cerrando sesión. Sin sesión, sí regresa ahí. */}
                <button
                    type="button"
                    onClick={() => {
                        if (!isAuthenticated) navigate("/");
                    }}
                    className="flex items-center gap-2 text-accent shrink-0 cursor-pointer"
                >
                    <Logo size={20} />
                    <h4>Nextticket</h4>
                </button>

                {/* Navegacion: en movil se va a la barra inferior */}
                <nav className="hidden md:flex flex-1 justify-center">
                    <Tabs
                        aria-label="Navegacion del cliente"
                        variant="secondary"
                        selectedKey={activeKey}
                    >
                        <Tabs.ListContainer className="border-none">
                            <Tabs.List>
                                {visibleLinks.map(({ to, icon: NavIcon, label }) => (
                                    <Tabs.Tab
                                        key={to}
                                        id={to}
                                        href={to}
                                        className="flex items-center gap-2 whitespace-nowrap"
                                        render={({ href, ...domProps }: any) => (
                                            <Router.Link to={href} {...domProps} />
                                        )}
                                    >
                                        <NavIcon className="size-4 shrink-0" />
                                        <span>{label}</span>
                                        <Tabs.Indicator className="rounded-full" />
                                    </Tabs.Tab>
                                ))}
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                </nav>

                <div className="flex items-center md:gap-2 gap-1 shrink-0">
                    <Tooltip>
                        <Tooltip.Trigger>
                            <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                onPress={() => navigate("/checkout")}
                            >
                                <Icon.ShoppingCart />
                                {seats.length > 0 && (
                                    <Chip size="sm" variant="soft" className="ml-1">
                                        {seats.length}
                                    </Chip>
                                )}
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                            {seats.length > 0
                                ? `${seats.length} ${seats.length === 1 ? "asiento" : "asientos"} en el carrito`
                                : "Carrito"}
                        </Tooltip.Content>
                    </Tooltip>

                    {isAuthenticated && user ? (
                        <Dropdown>
                            <Button size="sm" variant="ghost" className="gap-2">
                                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                                    {getInitials(user.name)}
                                </span>
                                <span className="hidden md:inline max-w-[140px] truncate">
                                    {user.name}
                                </span>
                                <Icon.ChevronDown className="size-4" />
                            </Button>

                            <Dropdown.Popover placement="bottom end" className="min-w-0">
                                <Dropdown.Menu>
                                    <Dropdown.Item
                                        id="perfil"
                                        textValue="Mi perfil"
                                        onAction={() => navigate("/perfil")}
                                    >
                                        <Icon.User className="size-4" />
                                        Mi perfil
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        id="boletos"
                                        textValue="Mis boletos"
                                        onAction={() => navigate("/mis-boletos")}
                                    >
                                        <Icon.Ticket className="size-4" />
                                        Mis boletos
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        id="compras"
                                        textValue="Mis compras"
                                        onAction={() => navigate("/mis-compras")}
                                    >
                                        <Icon.ReceiptText className="size-4" />
                                        Mis compras
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        id="salir"
                                        textValue="Cerrar sesión"
                                        onAction={handleSignOut}
                                    >
                                        <Icon.LogOut className="size-4" />
                                        Cerrar sesión
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    ) : (
                        <Button
                            size="sm"
                            onPress={() => navigate("/sign-in")}
                        >
                            <Icon.LogIn />
                            <span className="hidden md:inline">Iniciar sesión</span>
                        </Button>
                    )}
                </div>
            </header>

            {isProfileRoute && (
                <div className="px-2">
                    <Breadcrumbs>
                        <Breadcrumbs.Item>Cliente</Breadcrumbs.Item>
                        <Breadcrumbs.Item>Perfil</Breadcrumbs.Item>
                    </Breadcrumbs>
                </div>
            )}

            <ScrollShadow className="flex-1 overflow-auto relative pb-[88px] md:pb-2 px-2">
                <Router.Outlet />
            </ScrollShadow>

            {/* Navegacion inferior en movil, igual que en el shell de organizador */}
            <div className="md:hidden absolute inset-x-0 bottom-0 p-4 z-50 pointer-events-none flex justify-center">
                <ScrollShadow
                    orientation="horizontal"
                    className="px-2 flex bg-surface shadow-overlay rounded-[10px] pointer-events-auto max-w-full"
                >
                    <Tabs
                        aria-label="Navegacion del cliente en movil"
                        variant="secondary"
                        selectedKey={activeKey}
                    >
                        <Tabs.ListContainer className="border-none">
                            <Tabs.List>
                                {visibleLinks.map(({ to, icon: NavIcon, label }) => (
                                    <Tabs.Tab
                                        key={to}
                                        id={to}
                                        href={to}
                                        className="flex gap-2 h-fit w-20 pt-4 pb-2"
                                        render={({ href, ...domProps }: any) => (
                                            <Router.Link to={href} {...domProps} />
                                        )}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <NavIcon className="size-4" />
                                            <span className="text-xs">{label}</span>
                                        </div>
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
