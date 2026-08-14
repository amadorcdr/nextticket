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

interface FolioValidationFormProps {
    event: ValidatorEvent;
    isProcessing: boolean;
    onValidate: (result: ValidationResult) => void;
    onProcessingChange: (isProcessing: boolean) => void;
    onServiceError: (message: string) => void;
}

/** Validación por folio contra POST /tickets/validations (tickets-service). */
export function FolioValidationForm({
    event,
    isProcessing,
    onValidate,
    onProcessingChange,
    onServiceError,
}: FolioValidationFormProps) {
    const api = useApi();
    const [folio, setFolio] = useState("");
    const [error, setError] = useState<string | null>(null);

    function handleSubmit(event_: FormEvent<HTMLFormElement>) {
        event_.preventDefault();

        const trimmed = folio.trim();
        if (!trimmed) {
            setError("Ingresa un folio para continuar.");
            return;
        }

        setError(null);
        onProcessingChange(true);

        validateTicket(api, event, { folio: trimmed }, "folio")
            .then(onValidate)
            .catch((err) => {
                onServiceError(
                    err instanceof ApiError ? err.message : "No se pudo validar el boleto. Intenta de nuevo.",
                );
            })
            .finally(() => onProcessingChange(false));
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField
                value={folio}
                onChange={(value) => {
                    setFolio(value);
                    if (error) setError(null);
                }}
                isInvalid={Boolean(error)}
                isDisabled={isProcessing}
                autoComplete="off"
                fullWidth
            >
                <Label>Folio del boleto</Label>
                <Input placeholder="Ej. TK-A1B2C3D4E5" className="font-mono uppercase" />
                <Description>Escribe el folio impreso o mostrado en el boleto del asistente.</Description>
                <FieldError>{error}</FieldError>
            </TextField>

            <Button type="submit" fullWidth isDisabled={isProcessing}>
                {isProcessing ? <Spinner size="sm" color="current" /> : <Icon.TicketCheck />}
                {isProcessing ? "Validando…" : "Validar folio"}
            </Button>
        </form>
    );
}
