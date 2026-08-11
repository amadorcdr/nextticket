import React from "react";

/**
 * Respeta el tema elegido por el usuario (claro, oscuro, sistema o una marca
 * personalizada) en lugar de forzar uno fijo. `useTheme` ya se encarga de
 * persistir y aplicar el tema activo al documento.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return children;
}
