import React, { useEffect } from "react";
import { useTheme } from "@heroui/react";

/**
 * Tema fijo en oscuro para todo el equipo.
 *
 * Antes seguía la preferencia del sistema operativo, así que cada quien veía
 * la app distinta (unos en blanco y otros en negro) y las capturas no
 * coincidían. El diseño se trabaja en oscuro, así que se fija aquí.
 *
 * Para volver a que siga al sistema: cambiar "dark" por "system".
 */
const FORCED_THEME = "dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (theme !== FORCED_THEME) {
            setTheme(FORCED_THEME);
        }
    }, [theme, setTheme]);

    return children;
}
