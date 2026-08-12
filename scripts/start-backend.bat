@echo off
REM Arranca los 5 microservicios del backend, cada uno en su propia ventana.
REM Uso: desde la raiz del repo -> scripts\start-backend.bat
REM Requiere que docker compose up -d ya este corriendo (Postgres + Redis).

set ROOT=%~dp0..

start "api-gateway (3001)"            cmd /k "cd /d %ROOT%\apps\backend\api-gateway && pnpm start:dev"
start "auth-service (3002)"           cmd /k "cd /d %ROOT%\apps\backend\auth-service && pnpm start:dev"
start "venues-events-service (3003)"  cmd /k "cd /d %ROOT%\apps\backend\venues-events-service && pnpm start:dev"
start "purchases-service (3004)"      cmd /k "cd /d %ROOT%\apps\backend\purchases-service && pnpm start:dev"
start "tickets-service (3005)"        cmd /k "cd /d %ROOT%\apps\backend\tickets-service && pnpm start:dev"
