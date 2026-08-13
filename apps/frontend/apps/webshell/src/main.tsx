import { createRoot } from 'react-dom/client';
import { Router, ThemeProvider, CartProvider, SessionProvider, ToastProvider, RequireRole } from '@nextticket-frontend/commons';

import { App } from './App';
import { AuthModule, SignIn, SignUp } from "@nextticket-frontend/auth-front";
import { PurchasesModule } from "@nextticket-frontend/purchases-front";
import { TicketsModule, EventSalesSummary } from "@nextticket-frontend/tickets-front";
import { VenuesModule, VenueEditView, VenueCanvasCreate, VenueCanvasEdit } from "@nextticket-frontend/venues-front";
import {
    EventsModule,
    EventsCatalog,
    EventDetail,
    SeatSelection,
} from "@nextticket-frontend/events-front";
import {
    Checkout,
    CheckoutConfirmation,
} from "@nextticket-frontend/purchases-front";
import { ValidatorModule } from "@nextticket-frontend/validator-front";
import { UsersModule } from "@nextticket-frontend/users-front";
import { OrganizerLayout, OrganizerDashboard, MyEvents, SalesEvent, ZonesEditor } from "@nextticket-frontend/organizer-front";
import { Dashboard } from "./Dashboard";
import { Home } from "./Home";
import { NotFound } from "./NotFound";
import { ClientLayout } from "./ClientLayout";
import './index.css';

createRoot(document.getElementById('root')!).render(
        <ThemeProvider>
          <SessionProvider>
          <ToastProvider placement="bottom end" width={320} />
          <CartProvider>
            <Router.BrowserRouter>
                <Router.Routes>
                    <Router.Route path="/" element={<Home />} />

                    {/* El Validador tiene su propio layout: no usa el panel administrativo */}
                    <Router.Route element={<RequireRole roles={["validador", "admin"]} />}>
                        <Router.Route path="validator/*" element={<ValidatorModule />} />
                    </Router.Route>

                    {/* El Organizador tiene su propio sidebar (mismo estilo que App), sin las
                        secciones de admin (Recintos/Usuarios) que no le corresponden */}
                    <Router.Route element={<RequireRole roles={["organizador", "admin"]} />}>
                        <Router.Route element={<OrganizerLayout />}>
                            <Router.Route path="organizer/dashboard" element={<OrganizerDashboard />} />
                            <Router.Route path="organizer/myEvents" element={<MyEvents />} />
                            <Router.Route path="organizer/salesEvent" element={<SalesEvent />} />
                            <Router.Route path="organizer/zonas" element={<ZonesEditor />} />
                        </Router.Route>
                    </Router.Route>

                    {/* El Cliente tampoco: navega el catálogo, compra y ve sus boletos.
                        Sus pantallas viven en varios microfrontends, por eso el layout
                        se monta aquí y no dentro de uno solo. Catálogo y detalle son
                        públicos (cualquiera puede explorar sin sesión); a partir de elegir
                        asientos ya se pide sesión, como en cualquier tienda en línea. */}
                    <Router.Route element={<ClientLayout />}>
                        <Router.Route path="eventos" element={<EventsCatalog />} />
                        <Router.Route path="event/:eventId" element={<EventDetail />} />

                        <Router.Route element={<RequireRole />}>
                            <Router.Route
                                path="event/:eventId/asientos"
                                element={<SeatSelection />}
                            />
                            <Router.Route path="checkout" element={<Checkout />} />
                            <Router.Route
                                path="checkout/confirmacion"
                                element={<CheckoutConfirmation />}
                            />
                            <Router.Route path="mis-boletos" element={<TicketsModule />} />
                        </Router.Route>
                    </Router.Route>

                    <Router.Route element={<AuthModule />}>
                        <Router.Route path="sign-in" element={<SignIn />} />
                        <Router.Route path="sign-up" element={<SignUp />} />
                    </Router.Route>

                    {/* Panel administrativo: recintos, usuarios, eventos y tickets a nivel
                        global. Exclusivo de ADMIN. */}
                    <Router.Route element={<RequireRole roles={["admin"]} />}>
                        <Router.Route element={<App />}>
                            <Router.Route path="dashboard" element={<Dashboard />} />
                            <Router.Route path="purchases/*" element={<PurchasesModule />} />

                            <Router.Route path="venues">
                                <Router.Route index element={<VenuesModule />} />
                                <Router.Route path="canvas" element={<VenueCanvasCreate />} />
                                <Router.Route path=":id/edit" element={<VenueEditView />} />
                                <Router.Route path=":id/canvas" element={<VenueCanvasEdit />} />
                            </Router.Route>

                            <Router.Route path="events/*" element={<EventsModule />} />
                            <Router.Route path="users/*" element={<UsersModule />} />
                            <Router.Route path="tickets/:eventId" element={<EventSalesSummary />} />
                        </Router.Route>
                    </Router.Route>

                    <Router.Route path="*" element={<NotFound />} />
                </Router.Routes>
            </Router.BrowserRouter>
          </CartProvider>
          </SessionProvider>
        </ThemeProvider>
);