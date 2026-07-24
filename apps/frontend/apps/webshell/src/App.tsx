// Compara con la variante runtime:
//   runtime:    const M = lazy(() => import('inventory_front/ProductsModule'))
//   build-time: import { InventoryModule } from '@nimbus/inventory-front'

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
    VenuesEventsModule,
    OrganizerDashboardView,
    OrganizerMyEventsView,
    OrganizerSalesEventView,
} from "@nextticket-frontend/venues-events";
import { ValidatorPage, ValidatorEventsPage } from "@nextticket-frontend/tickets";
import { AuthModule } from "@nextticket-frontend/auth-front";
import { Navbar, Footer } from "@nextticket-frontend/commons/ui";

// Aquí NO hace falta lazy, ni Suspense, ni boundary: ya está en el bundle.
export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<AuthModule />} />
                <Route path="/organizer/dashboard" element={<OrganizerDashboardView />} />
                <Route path="/organizer/myEvents" element={<OrganizerMyEventsView />} />
                <Route path="/organizer/salesEvent" element={<OrganizerSalesEventView />} />
                <Route path="/validator" element={<ValidatorPage />} />
                <Route path="/validator/events" element={<ValidatorEventsPage />} />
            </Routes>
        </BrowserRouter>
    );
}

// AuthModule ya trae su propio Navbar/Footer (con hideActions), así que solo
// la landing necesita este wrapper de layout.
function LandingPage() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="bg-background text-on-background font-sans selection:bg-primary-container selection:text-on-primary-container">
            <Navbar scrolled={scrolled} />

            <main className="pt-16">
                <VenuesEventsModule />
            </main>

            <Footer />
        </div>
    );
}