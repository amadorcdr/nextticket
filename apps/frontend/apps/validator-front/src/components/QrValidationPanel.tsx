import { useState, type FormEvent } from "react";
import {
    ApiError,
    Button,
    Description,
    FieldError,
    Icon,
    Input,
    Label,
    Spinner,
    TextField,
    useApi,
} from "@nextticket-frontend/commons";
import { validateTicket } from "../api";
import type { ValidatorEvent } from "../types/validatorEvents";
import type { ValidationResult } from "../types/validatorTickets";

interface QrValidationPanelProps {
    event: ValidatorEvent;
    isProcessing: boolean;
    onValidate: (result: ValidationResult) => void;
    onProcessingChange: (isProcessing: boolean) => void;
    onServiceError: (message: string) => void;
}

/**
 * Validación por QR contra POST /tickets/validations (tickets-service).
 * El QR del boleto codifica directamente el hash SHA-256 (ver
 * tickets.service.ts#generateQrImage): no hay otro formato de payload.
 *
 * Pendiente: el acceso a cámara para leer el QR físico todavía no está
 * conectado (no hay librería de escaneo en el proyecto). Mientras tanto,
 * el hash leído del QR se captura manualmente aquí y se procesa con la
 * misma llamada real que usará el lector una vez conectado.
 */
export function QrValidationPanel({
    event,
    isProcessing,
    onValidate,
    onProcessingChange,
    onServiceError,
}: QrValidationPanelProps) {
    const api = useApi();
    const [qrHash, setQrHash] = useState("");
    const [error, setError] = useState<string | null>(null);

    function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();

        const trimmed = qrHash.trim().toLowerCase();
        if (!trimmed) {
            setError("Captura el contenido del código QR.");
            return;
        }

        setError(null);
        onProcessingChange(true);

        validateTicket(api, event, { qrHash: trimmed }, "qr")
            .then((result) => {
                onValidate(result);
                setQrHash("");
            })
            .catch((err) => {
                onServiceError(
                    err instanceof ApiError ? err.message : "No se pudo validar el boleto. Intenta de nuevo.",
                );
            })
            .finally(() => onProcessingChange(false));
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Área visual del lector. La cámara todavía no está conectada. */}
            <div className="mx-auto w-full max-w-xs">
                <div className="relative aspect-square rounded-[10px] border-2 border-dashed border-border bg-surface-secondary flex flex-col items-center justify-center gap-3 overflow-hidden">
                    {isProcessing ? (
                        <>
                            <Spinner size="lg" />
                            <span className="text-sm text-muted">Validando código…</span>
                            <span className="absolute inset-x-6 h-0.5 bg-accent/70 animate-pulse" />
                        </>
                    ) : (
                        <>
                            <Icon.Camera className="size-10! text-muted" />
                            <span className="text-sm text-muted text-center px-6">
                                Acceso a cámara pendiente. Captura el código manualmente por ahora.
                            </span>
                        </>
                    )}

                    <span className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-accent/60 rounded-tl-[6px]" />
                    <span className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-accent/60 rounded-tr-[6px]" />
                    <span className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-accent/60 rounded-bl-[6px]" />
                    <span className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-accent/60 rounded-br-[6px]" />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <TextField
                    value={qrHash}
                    onChange={(value) => {
                        setQrHash(value);
                        if (error) setError(null);
                    }}
                    isInvalid={Boolean(error)}
                    isDisabled={isProcessing}
                    autoComplete="off"
                    fullWidth
                >
                    <Label>Contenido del código QR</Label>
                    <Input placeholder="Hash leído del QR del boleto" className="font-mono" />
                    <Description>
                        Pega o escribe el contenido del QR escaneado con un lector externo mientras se conecta
                        la cámara.
                    </Description>
                    <FieldError>{error}</FieldError>
                </TextField>

                <Button type="submit" fullWidth isDisabled={isProcessing}>
                    {isProcessing ? <Spinner size="sm" color="current" /> : <Icon.ScanLine />}
                    {isProcessing ? "Validando…" : "Validar código"}
                </Button>
            </form>
        </div>
    );
}
