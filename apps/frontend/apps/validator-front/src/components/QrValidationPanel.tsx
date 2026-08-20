import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import QrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { ApiError, Button, Icon, Spinner, useApi } from "@nextticket-frontend/commons";
import { validateTicket } from "../api";
import type { ValidatorEvent } from "../types/validatorEvents";
import type { ValidationResult } from "../types/validatorTickets";

QrScanner.WORKER_PATH = QrScannerWorkerPath;

interface QrValidationPanelProps {
    event: ValidatorEvent;
    isProcessing: boolean;
    /** Resultado actual mostrado en la página. Al pasar de un valor a `null`
     *  (botón "Validar otro boleto") el lector se reactiva. */
    result: ValidationResult | null;
    onValidate: (result: ValidationResult) => void;
    onProcessingChange: (isProcessing: boolean) => void;
    onServiceError: (message: string) => void;
}

type CameraState = "requesting" | "active" | "denied" | "no-camera" | "error";

const CAMERA_ERROR_MESSAGES: Record<Exclude<CameraState, "requesting" | "active">, string> = {
    denied: "Permiso de cámara denegado. Actívalo en tu navegador o usa la validación por folio.",
    "no-camera": "No se detectó una cámara en este dispositivo. Usa la validación por folio.",
    error: "No se pudo iniciar la cámara. Usa la validación por folio o intenta de nuevo.",
};

/**
 * Validación por QR contra POST /tickets/validations (tickets-service),
 * la misma llamada que usa la validación por folio. El QR del boleto
 * codifica directamente el hash SHA-256 (ver tickets.service.ts#generateQrImage),
 * así que el contenido leído de la cámara se envía tal cual como `qrHash`.
 */
export function QrValidationPanel({
    event,
    isProcessing,
    result,
    onValidate,
    onProcessingChange,
    onServiceError,
}: QrValidationPanelProps) {
    const api = useApi();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<QrScanner | null>(null);
    const lockedRef = useRef(false);
    const prevResultRef = useRef(result);

    /** Última versión de todo lo que el callback de decodificación necesita,
     *  para que el QrScanner (creado una sola vez) nunca use closures viejos. */
    const latestRef = useRef({ event, api, onValidate, onProcessingChange, onServiceError });
    latestRef.current = { event, api, onValidate, onProcessingChange, onServiceError };

    const [cameraState, setCameraState] = useState<CameraState>("requesting");

    function classifyStartError(err: unknown): CameraState {
        const name = err instanceof Error ? err.name : "";
        const message = (err instanceof Error ? err.message : String(err)).toLowerCase();

        if (name === "NotAllowedError" || name === "SecurityError" || message.includes("permission")) {
            return "denied";
        }
        if (name === "NotFoundError" || name === "OverconstrainedError" || message.includes("no camera")) {
            return "no-camera";
        }
        return "error";
    }

    function startScanner(scanner: QrScanner) {
        setCameraState("requesting");
        scanner
            .start()
            .then(() => setCameraState("active"))
            .catch((err: unknown) => setCameraState(classifyStartError(err)));
    }

    // Crea el lector una sola vez por evento seleccionado y libera la cámara
    // al desmontar (cambio de método, de evento, o salida de la vista/módulo).
    useEffect(() => {
        if (!videoRef.current) return;

        const scanner = new QrScanner(
            videoRef.current,
            (scanResult) => {
                if (lockedRef.current) return;
                lockedRef.current = true;
                scanner.pause();

                const { event, api, onValidate, onProcessingChange, onServiceError } = latestRef.current;
                const qrHash = scanResult.data.trim().toLowerCase();

                onProcessingChange(true);
                validateTicket(api, event, { qrHash }, "qr")
                    .then((next) => onValidate(next))
                    .catch((err) => {
                        lockedRef.current = false;
                        scanner.start().catch(() => {});
                        onServiceError(
                            err instanceof ApiError
                                ? err.message
                                : "No se pudo validar el boleto. Intenta de nuevo.",
                        );
                    })
                    .finally(() => onProcessingChange(false));
            },
            {
                highlightScanRegion: true,
                highlightCodeOutline: true,
                preferredCamera: "environment",
                maxScansPerSecond: 5,
            },
        );

        scannerRef.current = scanner;
        startScanner(scanner);

        return () => {
            scanner.stop();
            scanner.destroy();
            scannerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.id]);

    // "Validar otro boleto" limpia el resultado en la página -> reactiva el lector.
    useEffect(() => {
        if (prevResultRef.current && !result && scannerRef.current) {
            lockedRef.current = false;
            scannerRef.current.start().catch(() => {});
        }
        prevResultRef.current = result;
    }, [result]);

    function handleRetry() {
        if (scannerRef.current) startScanner(scannerRef.current);
    }

    const showOverlay = cameraState !== "active" || isProcessing;

    return (
        <div className="flex flex-col gap-4">
            <div className="mx-auto w-full max-w-xs">
                <div className="relative aspect-square rounded-[10px] border-2 border-dashed border-border bg-surface-secondary overflow-hidden">
                    <video ref={videoRef} muted playsInline className="absolute inset-0 size-full object-cover" />

                    {showOverlay ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-secondary/95 px-6 text-center">
                            {isProcessing ? (
                                <>
                                    <Spinner size="lg" />
                                    <span className="text-sm text-muted">Validando código…</span>
                                </>
                            ) : cameraState === "requesting" ? (
                                <>
                                    <Spinner size="lg" />
                                    <span className="text-sm text-muted">Solicitando acceso a la cámara…</span>
                                </>
                            ) : cameraState === "active" ? null : (
                                <>
                                    <Icon.CameraOff className="size-10! text-muted" />
                                    <span className="text-sm text-muted">
                                        {CAMERA_ERROR_MESSAGES[cameraState]}
                                    </span>
                                    <Button size="sm" variant="secondary" onPress={handleRetry}>
                                        <Icon.RotateCcw />
                                        Reintentar
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : null}

                    <span className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-accent/60 rounded-tl-[6px]" />
                    <span className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-accent/60 rounded-tr-[6px]" />
                    <span className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-accent/60 rounded-bl-[6px]" />
                    <span className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-accent/60 rounded-br-[6px]" />
                </div>
            </div>

            <p className="text-sm text-muted flex items-center gap-2 justify-center text-center">
                <Icon.ScanLine className="size-4 shrink-0" />
                Apunta la cámara al código QR del boleto. La validación se envía automáticamente al detectarlo.
            </p>
        </div>
    );
}
