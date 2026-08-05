import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, ThemeProvider, CartProvider, PhysicalEditor } from '@nextticket-frontend/commons';

import { App } from './App';
import { AuthModule, SignIn, SignUp } from "@nextticket-frontend/auth-front";
import { PurchasesModule } from "@nextticket-frontend/purchases-front";
import { TicketsModule } from "@nextticket-frontend/tickets-front";
import { VenuesModule } from "@nextticket-frontend/venues-front";
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
    <StrictMode>
        <ThemeProvider>
          <CartProvider>
            <Router.BrowserRouter>
                <Router.Routes>
                    <Router.Route path="/" element={<Home />} />

                    {/* El Validador tiene su propio layout: no usa el panel administrativo */}
                    <Router.Route path="validator/*" element={<ValidatorModule />} />

                    {/* El Organizador tiene su propio sidebar (mismo estilo que App), sin las
                        secciones de admin (Recintos/Usuarios) que no le corresponden */}
                    <Router.Route element={<OrganizerLayout />}>
                        <Router.Route path="organizer/dashboard" element={<OrganizerDashboard />} />
                        <Router.Route path="organizer/myEvents" element={<MyEvents />} />
                        <Router.Route path="organizer/salesEvent" element={<SalesEvent />} />
                        <Router.Route path="organizer/zonas" element={<ZonesEditor />} />
                    </Router.Route>

                    {/* El Cliente tampoco: navega el catálogo, compra y ve sus boletos.
                        Sus pantallas viven en varios microfrontends, por eso el layout
                        se monta aquí y no dentro de uno solo. */}
                    <Router.Route element={<ClientLayout />}>
                        <Router.Route path="eventos" element={<EventsCatalog />} />
                        <Router.Route path="event/:eventId" element={<EventDetail />} />
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

                    <Router.Route element={<AuthModule />}>
                        <Router.Route path="sign-in" element={<SignIn />} />
                        <Router.Route path="sign-up" element={<SignUp />} />
                    </Router.Route>

                    <Router.Route element={<App />}>
                        <Router.Route path="dashboard" element={<Dashboard />} />
                        <Router.Route path="purchases/*" element={<PurchasesModule />} />
                        <Router.Route path="tickets/*" element={<TicketsModule />} />

                        <Router.Route path="venues">
                            <Router.Route index element={<VenuesModule />} />
                            <Router.Route path="canvas" element={<PhysicalEditor />} />
                        </Router.Route>

                        <Router.Route path="events/*" element={<EventsModule />} />
                        <Router.Route path="users/*" element={<UsersModule />} />
                    </Router.Route>

                    <Router.Route path="*" element={<NotFound />} />
                </Router.Routes>
            </Router.BrowserRouter>
          </CartProvider>
        </ThemeProvider>
    </StrictMode>
);