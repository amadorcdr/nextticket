import { useEffect, useState } from "react";
import { ApiError, Button, Icon, Router, useApi } from "@nextticket-frontend/commons";

type QueueStatus = "WAITING" | "ADMITTED" | "EXPIRED" | "CANCELED";

interface QueueEntry {
    queueEntryId: string;
    eventId: string;
    status: QueueStatus;
    position?: number;
    admissionExpiresAt?: string;
    createdAt: string;
}

const POLL_INTERVAL_MS = 3000;
const ADMITTED_REDIRECT_DELAY_MS = 1000;

function idempotencyStorageKey(eventId: string) {
    return `nextticket:queue-idem:${eventId}`;
}

/** Reutiliza la clave guardada (un refresh no debe crear una entrada nueva) o genera una. */
function readOrCreateIdempotencyKey(eventId: string): string {
    const key = idempotencyStorageKey(eventId);
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;

    const next = crypto.randomUUID();
    window.sessionStorage.setItem(key, next);
    return next;
}

function createNewIdempotencyKey(eventId: string): string {
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(idempotencyStorageKey(eventId), next);
    return next;
}

/**
 * Fila virtual: pantalla intermedia obligatoria antes de elegir asientos.
 * No existía en el diseño original — la pide el backend (purchases-service
 * exige una admisión ACTIVA en la fila antes de aceptar un hold de asientos).
 */
export function VirtualQueue() {
    const { eventId } = Router.useParams();
    const navigate = Router.useNavigate();
    const api = useApi();

    const [entry, setEntry] = useState<QueueEntry | null>(null);
    const [joining, setJoining] = useState(true);
    const [fatalError, setFatalError] = useState<string | null>(null);

    const join = (useNewKey: boolean) => {
        if (!eventId) return;

        setJoining(true);
        setFatalError(null);
        setEntry(null);

        const idempotencyKey = useNewKey
            ? createNewIdempotencyKey(eventId)
            : readOrCreateIdempotencyKey(eventId);

        api.post<QueueEntry>(`/purchases/queue/${eventId}`, { idempotencyKey })
            .then(setEntry)
            .catch((err) => {
                if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
                    setFatalError(
                        err.status === 404
                            ? "Este evento ya no existe."
                            : "Este evento no está publicado para la venta.",
                    );
                    return;
                }
                setFatalError(err instanceof ApiError ? err.message : "No se pudo unir a la fila virtual");
            })
            .finally(() => setJoining(false));
    };

    // Se une a la fila al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => join(false), [eventId]);

    // Sondeo del estado mientras la entrada siga en espera; se detiene solo
    // (no arma un nuevo intervalo) en cuanto el status deja de ser WAITING.
    useEffect(() => {
        if (!eventId || !entry || entry.status !== "WAITING") return;

        const interval = window.setInterval(() => {
            api.get<QueueEntry>(`/purchases/queue/${eventId}/me`)
                .then(setEntry)
                .catch((err) => {
                    if (err instanceof ApiError && err.status === 404) {
                        setFatalError("Tu turno en la fila ya no existe.");
                    }
                    // Otros errores de sondeo se ignoran: se reintenta en el siguiente tick.
                });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, entry?.status]);

    // Admitido: pasa solo a elegir asientos, con un respiro para que se vea el estado.
    useEffect(() => {
        if (!eventId || entry?.status !== "ADMITTED") return;

        const timeout = window.setTimeout(() => {
            navigate(`/event/${eventId}/asientos`);
        }, ADMITTED_REDIRECT_DELAY_MS);

        return () => window.clearTimeout(timeout);
    }, [eventId, entry?.status, navigate]);

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.CalendarX className="size-8 text-muted" />
                <h4>Evento no encontrado</h4>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Volver al catálogo
                </Button>
            </div>
        );
    }

    if (fatalError) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.CircleAlert className="size-8 text-muted" />
                <h4>No se pudo entrar a la fila</h4>
                <p className="text-muted md:text-sm text-xs max-w-sm">{fatalError}</p>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Volver al catálogo
                </Button>
            </div>
        );
    }

    if (joining && !entry) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.LoaderCircle className="size-8 text-muted animate-spin" />
                <p className="text-muted md:text-sm text-xs">Uniéndote a la fila virtual...</p>
            </div>
        );
    }

    if (!entry) return null;

    return (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
            <div className="w-full max-w-sm rounded-[10px] bg-surface shadow-surface p-6 flex flex-col items-center gap-4">
                {entry.status === "WAITING" && (
                    <>
                        <div className="flex size-14 items-center justify-center rounded-full bg-accent/10">
                            <Icon.Clock className="size-7 text-accent" />
                        </div>
                        <div>
                            <h3>Esperando turno...</h3>
                            <p className="text-muted md:text-sm text-xs mt-1">
                                No cierres esta pantalla, tu lugar se guarda solo.
                            </p>
                        </div>
                        {typeof entry.position === "number" && (
                            <div className="rounded-[10px] bg-surface-secondary px-4 py-2">
                                <span className="text-2xl font-semibold">{entry.position}</span>
                                <span className="text-muted md:text-sm text-xs ml-2">en fila</span>
                            </div>
                        )}
                    </>
                )}

                {entry.status === "ADMITTED" && (
                    <>
                        <div className="flex size-14 items-center justify-center rounded-full bg-success/10">
                            <Icon.Check className="size-7 text-success" />
                        </div>
                        <div>
                            <h3>¡Ya puedes continuar!</h3>
                            <p className="text-muted md:text-sm text-xs mt-1">Te llevamos a elegir tus asientos...</p>
                        </div>
                        <Button onPress={() => navigate(`/event/${eventId}/asientos`)}>
                            Continuar
                            <Icon.ArrowRight />
                        </Button>
                    </>
                )}

                {(entry.status === "EXPIRED" || entry.status === "CANCELED") && (
                    <>
                        <div className="flex size-14 items-center justify-center rounded-full bg-warning/10">
                            <Icon.TimerOff className="size-7 text-warning" />
                        </div>
                        <div>
                            <h3>{entry.status === "EXPIRED" ? "Tu turno expiró" : "Tu turno se canceló"}</h3>
                            <p className="text-muted md:text-sm text-xs mt-1">
                                Puedes volver a intentarlo, se te asigna un lugar nuevo.
                            </p>
                        </div>
                        <Button onPress={() => join(true)} isDisabled={joining}>
                            {joining ? (
                                <>
                                    <Icon.LoaderCircle className="animate-spin" />
                                    Reintentando...
                                </>
                            ) : (
                                <>
                                    <Icon.RotateCw />
                                    Reintentar
                                </>
                            )}
                        </Button>
                    </>
                )}
            </div>

            <Button variant="ghost" size="sm" onPress={() => navigate("/eventos")}>
                Cancelar y volver al catálogo
            </Button>
        </div>
    );
}
