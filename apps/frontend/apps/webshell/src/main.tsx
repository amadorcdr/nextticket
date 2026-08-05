import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, ThemeProvider, PhysicalEditor } from '@nextticket-frontend/commons';

import { App } from './App';
import { AuthModule, SignIn, SignUp } from "@nextticket-frontend/auth-front";
import { PurchasesModule } from "@nextticket-frontend/purchases-front";
import { TicketsModule } from "@nextticket-frontend/tickets-front";
import { VenuesModule } from "@nextticket-frontend/venues-front";
import { EventsModule } from "@nextticket-frontend/events-front";
import { ValidatorModule } from "@nextticket-frontend/validator-front";
import { UsersModule } from "@nextticket-frontend/users-front";
import { Dashboard } from "./Dashboard";
import { Home } from "./Home";
import { NotFound } from "./NotFound";
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <Router.BrowserRouter>
                <Router.Routes>
                    <Router.Route path="/" element={<Home />} />

                    {/* El Validador tiene su propio layout: no usa el panel administrativo */}
                    <Router.Route path="validator/*" element={<ValidatorModule />} />

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
        </ThemeProvider>
    </StrictMode>
);