import { useCallback, useState } from "react";
import { Breadcrumbs, Button, Icon, Logo, Panel, Router, ScrollShadow, Tabs, Tooltip, useBreakpoint, useSession } from "@nextticket-frontend/commons";

const NAV_LINKS = [
  { to: "/organizer/dashboard", icon: Icon.LayoutDashboard, label: "Dashboard" },
  { to: "/organizer/myEvents", icon: Icon.Calendar, label: "Mis Eventos" },
  { to: "/organizer/zonas", icon: Icon.LayoutGrid, label: "Zonas de Venta" },
  { to: "/organizer/salesEvent", icon: Icon.Wallet, label: "Ventas" },
];

export function OrganizerLayout() {
  const isDesktop = useBreakpoint(1024);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const { signOut } = useSession();

  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), []);

  const location = Router.useLocation();
  const navigate = Router.useNavigate();

  const handleSignOut = () => {
    // Navega primero a una ruta pública y limpia la sesión después: así el
    // guard de esta ruta no alcanza a redirigir a /sign-in antes de salir.
    navigate("/", { replace: true });
    setTimeout(signOut, 0);
  };

  const activeNavKey = NAV_LINKS.find((link) => location.pathname.startsWith(link.to))?.to ?? "none";
  const activeLabel = NAV_LINKS.find((link) => location.pathname.startsWith(link.to))?.label;

  const isNewEvent = location.pathname === "/organizer/myEvents/new";
  const isEditEvent = /^\/organizer\/myEvents\/[^/]+\/edit$/.test(location.pathname);
  const isProfile = location.pathname === "/organizer/profile";

  const navContent = (
    <div className="py-4 flex flex-col justify-between flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col gap-6 min-h-0 overflow-hidden">
        <div className="px-4 flex items-center gap-2 shrink-0 text-accent">
          <Logo size={20} />
          <h4>Nextticket</h4>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <p className="px-4 text-muted text-xs uppercase tracking-wide">Organizador</p>
          <Tabs aria-label="Navegación de organizador" variant="secondary" orientation="vertical" selectedKey={activeNavKey}>
            <Tabs.ListContainer className="border-none w-full">
              <Tabs.List className="w-full">
                {NAV_LINKS.map(({ to, icon: NavIcon, label }) => (
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
                    <Tabs.Indicator className="rounded-full" />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-2 shrink-0">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
        >
          <Icon.LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full relative p-2">
      <Panel isOpen={sidebarVisible} onOpenChange={setSidebarVisible} isDrawer={!isDesktop} placement="left">
        {navContent}
      </Panel>

      <div className="flex flex-col flex-1 min-w-0 gap-4 md:p-2 shadow-surface rounded-[10px]">
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex-1 flex items-center md:gap-2 gap-1 min-w-0">
            <Tooltip>
              <Tooltip.Trigger>
                <Button size="sm" variant="ghost" isIconOnly onPress={toggleSidebar}>
                  {sidebarVisible ? <Icon.PanelRightOpen /> : <Icon.PanelLeftOpen />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{sidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar"}</Tooltip.Content>
            </Tooltip>
            <ScrollShadow className="flex-1 min-w-0" orientation="horizontal" hideScrollBar size={16}>
              <Breadcrumbs>
                <Breadcrumbs.Item>Organizador</Breadcrumbs.Item>
                {isProfile ? <Breadcrumbs.Item>Perfil</Breadcrumbs.Item> : null}
                {!isProfile && activeLabel ? (
                  <Breadcrumbs.Item onPress={isNewEvent || isEditEvent ? () => navigate("/organizer/myEvents") : undefined}>
                    {activeLabel}
                  </Breadcrumbs.Item>
                ) : null}
                {isNewEvent ? <Breadcrumbs.Item>Crear evento</Breadcrumbs.Item> : null}
                {isEditEvent ? <Breadcrumbs.Item>Editar evento</Breadcrumbs.Item> : null}
              </Breadcrumbs>
            </ScrollShadow>
          </div>
          <div className="flex items-center md:gap-2 gap-1 shrink-0">
            <Tooltip>
              <Tooltip.Trigger>
                <Button size="sm" variant="ghost" isIconOnly onPress={() => navigate("/organizer/profile")}>
                  <Icon.User />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Perfil</Tooltip.Content>
            </Tooltip>
          </div>
        </div>

        <ScrollShadow className="flex-1 overflow-auto relative pb-[88px] md:pb-2 px-2">
          <Router.Outlet />
        </ScrollShadow>
      </div>

      {/* Navegación inferior en móvil */}
      <div className="md:hidden absolute inset-x-0 bottom-0 p-4 z-50 pointer-events-none flex justify-center">
        <ScrollShadow orientation="horizontal" className="px-2 flex bg-surface shadow-overlay rounded-[10px] pointer-events-auto max-w-full">
          <Tabs aria-label="Navegación de organizador móvil" variant="secondary" orientation="horizontal" selectedKey={activeNavKey}>
            <Tabs.ListContainer className="border-none">
              <Tabs.List>
                {NAV_LINKS.map(({ to, icon: NavIcon, label }) => (
                  <Tabs.Tab
                    key={to}
                    id={to}
                    href={to}
                    className="flex gap-2 h-fit w-16 pt-4 pb-2"
                    render={({ href, ...domProps }: any) => <Router.Link to={href} {...domProps} />}
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
