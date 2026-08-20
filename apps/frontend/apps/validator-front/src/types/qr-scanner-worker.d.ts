/** Vite resuelve `?url` como la URL pública del asset; qr-scanner necesita
 *  esa URL para cargar su worker. TS no conoce esta convención por defecto. */
declare module "qr-scanner/qr-scanner-worker.min.js?url" {
    const workerUrl: string;
    export default workerUrl;
}
