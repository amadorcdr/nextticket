import { useState, useCallback } from "react";
import { Button, Icon, Router, Breadcrumbs, Tooltip, Panel, useBreakpoint, ScrollShadow, Avatar, Tabs, Chip, Description, Badge, Calendar, Label, ThemeSwitcher, TextField, Input, Logo } from "@nextticket-frontend/commons";

const NAV_LINKS = [
    { to: "/dashboard", icon: Icon.LayoutDashboard, label: "Inicio" },
    { to: "/venues", icon: Icon.Home, label: "Recintos", count: 18 },
    { to: "/events", icon: Icon.Calendar, label: "Eventos", count: 5 },
    { to: "/tickets", icon: Icon.Ticket, label: "Tickets", count: 4 },
    { to: "/purchases", icon: Icon.Wallet, label: "Compras", count: 1 },
    { to: "/users", icon: Icon.Users, label: "Usuarios", count: 128 },
];

const VENUES = [
    { to: "/venues/auditorio-nacional", label: "Auditorio Nacional", capacity: "10,000" },
    { to: "/venues/foro-sol", label: "Foro Sol", capacity: "65,000" },
    { to: "/venues/estadio-azteca", label: "Estadio Azteca", capacity: "83,000" },
    { to: "/venues/arena-cdmx", label: "Arena CDMX", capacity: "22,300" },
    { to: "/venues/palacio-de-los-deportes", label: "Palacio de los Deportes", capacity: "20,000" },
    { to: "/venues/arena-monterrey", label: "Arena Monterrey", capacity: "17,599" },
    { to: "/venues/auditorio-telmex", label: "Auditorio Telmex", capacity: "11,500" },
    { to: "/venues/estadio-akron", label: "Estadio Akron", capacity: "46,232" },
    { to: "/venues/estadio-bbva", label: "Estadio BBVA", capacity: "53,500" },
    { to: "/venues/pepsi-center", label: "Pepsi Center WTC", capacity: "8,000" },
    { to: "/venues/teatro-metropolitan", label: "Teatro Metropólitan", capacity: "3,165" },
    { to: "/venues/auditorio-citibanamex", label: "Auditorio Citibanamex", capacity: "8,000" },
    { to: "/venues/arena-vfg", label: "Arena VFG", capacity: "15,000" },
    { to: "/venues/estadio-olimpico", label: "Estadio Olímpico Univ.", capacity: "72,000" },
    { to: "/venues/autodromo", label: "Autódromo H. Rodríguez", capacity: "110,000" },
    { to: "/venues/parque-fundidora", label: "Parque Fundidora", capacity: "90,000" },
    { to: "/venues/foro-del-lago", label: "Foro del Lago", capacity: "2,500" },
    { to: "/venues/teatro-diana", label: "Teatro Diana", capacity: "2,345" },
    { to: "/venues/pabellon-m", label: "Auditorio Pabellón M", capacity: "4,277" },
    { to: "/venues/estadio-cuauhtemoc", label: "Estadio Cuauhtémoc", capacity: "51,500" },
];

export function App() {
    const isDesktop = useBreakpoint(1024);

    const [sidebarVisible, setSidebarVisible] = useState(true);

    const toggleSidebar = useCallback(() => {
        setSidebarVisible((v) => !v);
    }, []);

    const location = Router.useLocation();
    const navigate = Router.useNavigate();

    const activeNavKey = NAV_LINKS.find(link => location.pathname.startsWith(link.to))?.to || "none";
    const activeVenueKey = VENUES.find(v => location.pathname.startsWith(v.to))?.to || "none";

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
                                {NAV_LINKS.map(({ to, icon: NavIcon, label, count }) => (
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
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                    <Description className="px-4 shrink-0">Tus recintos</Description>
                    <ScrollShadow className="flex-1 overflow-auto relative">
                        <Tabs
                            aria-label="Navegación de recintos"
                            variant="secondary"
                            orientation="vertical"
                            selectedKey={activeVenueKey}
                        >
                            <Tabs.ListContainer className="border-none w-full">
                                <Tabs.List className="w-full">
                                    {VENUES.map(({ to, label, capacity }) => (
                                        <Tabs.Tab
                                            key={to}
                                            id={to}
                                            href={to}
                                            className="flex justify-between w-full gap-2"
                                            render={({ href, ...domProps }: any) => <Router.Link to={href} {...domProps} />}
                                        >
                                            <div className="flex items-center flex-1 min-w-0 text-left">
                                                <span className="truncate">{label}</span>
                                            </div>
                                            <Chip variant="soft" color="default">
                                                {capacity}
                                            </Chip>
                                            <Tabs.Indicator className="rounded-full" />
                                        </Tabs.Tab>
                                    ))}
                                </Tabs.List>
                            </Tabs.ListContainer>
                        </Tabs>
                    </ScrollShadow>
                </div>
            </div>
            <div className="flex items-center gap-2 p-4"><Calendar aria-label="Event date">
                <Calendar.Header>
                    <Calendar.Heading />
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                    <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                </Calendar.Grid>
            </Calendar>
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
                                <Breadcrumbs.Item>
                                    Inicio
                                </Breadcrumbs.Item>
                                <Breadcrumbs.Item>
                                    Recintos
                                </Breadcrumbs.Item>
                                <Breadcrumbs.Item>
                                    Auditorio Nacional
                                </Breadcrumbs.Item>
                                <Breadcrumbs.Item>
                                    Piso 1
                                </Breadcrumbs.Item>
                                <Breadcrumbs.Item>
                                    Balcón
                                </Breadcrumbs.Item>
                            </Breadcrumbs>
                        </ScrollShadow>
                    </div>
                    <div className="flex items-center md:gap-2 gap-1 shrink-0">

                        <Tooltip>
                            <Tooltip.Trigger>



                                <Badge.Anchor>


                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        isIconOnly
                                    >
                                        <Icon.Bell />
                                    </Button>
                                    <Badge variant="soft" size="sm" color="default">
                                        25
                                    </Badge>
                                </Badge.Anchor>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Notificaciones</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                            <Tooltip.Trigger>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={() => navigate("/users/profile")}
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
                                {NAV_LINKS.map(({ to, icon: NavIcon, label, count }) => (
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