import { Router } from "@nextticket-frontend/commons";
import { SelectedEventProvider } from "./context/SelectedEventContext";
import { ValidatorLayout } from "./layout/ValidatorLayout";
import { EventsPage } from "./pages/EventsPage";
import { ValidationPage } from "./pages/ValidationPage";

/**
 * Módulo del rol Validador.
 * Consulta eventos y valida boletos contra el backend real (venues-events-service /
 * tickets-service vía el api-gateway); requiere sesión con rol validador/admin.
 */
export function ValidatorModule() {
    return (
        <SelectedEventProvider>
            <ValidatorLayout>
                <Router.Routes>
                    <Router.Route index element={<EventsPage />} />
                    <Router.Route path="validate" element={<ValidationPage />} />
                    <Router.Route path="*" element={<Router.Navigate to="/validator" replace />} />
                </Router.Routes>
            </ValidatorLayout>
        </SelectedEventProvider>
    );
}
