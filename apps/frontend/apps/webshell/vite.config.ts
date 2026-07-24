import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// NO hay plugin de federation, NO hay `remotes`, NO hay `exposes`. Solo React.
// Vite resuelve los paquetes del workspace (@nimbus/*) a su código fuente y los
// transpila como parte del bundle del host. En Next.js esto se declara con:
//   transpilePackages: ['@nimbus/inventory-front', '@nimbus/commons']
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: { port: 4000 },
    preview: { port: 4000 },
});