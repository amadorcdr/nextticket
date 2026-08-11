import { Router } from "@nextticket-frontend/commons";
import { Profile } from "@nextticket-frontend/users-front";
import { SelectedEventProvider } from "./context/SelectedEventContext";
import { ValidatorLayout } from "./layout/ValidatorLayout";
import { EventsPage } from "./pages/EventsPage";
import { ValidationPage } from "./pages/ValidationPage";

/**
 * Módulo del rol Validador.
 * Flujo 100% frontend con datos simulados: sin APIs, sesión, tokens ni permisos.
 */
export function ValidatorModule() {
    return (
        <SelectedEventProvider>
            <ValidatorLayout>
                <Router.Routes>
                    <Router.Route index element={<EventsPage />} />
                    <Router.Route path="validate" element={<ValidationPage />} />
                    <Router.Route path="profile" element={<Profile />} />
                    <Router.Route path="*" element={<Router.Navigate to="/validator" replace />} />
                </Router.Routes>
            </ValidatorLayout>
        </SelectedEventProvider>
    );
}
