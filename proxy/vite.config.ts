import { fileURLToPath } from 'node:url';
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
    const appUrl = process.env.APP_URL ?? 'http://localhost:8088';
    const viteDevServerUrl =
        process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5174';
    const viteDevServer = new URL(viteDevServerUrl);
    const viteDevServerHost =
        process.env.VITE_DEV_SERVER_HOST ?? viteDevServer.hostname;
    const viteDevServerClientPort = Number(
        process.env.VITE_DEV_SERVER_CLIENT_PORT ?? (viteDevServer.port || 5174),
    );
    const viteDevServerAllowedHosts = (
        process.env.VITE_DEV_SERVER_ALLOWED_HOSTS ?? viteDevServerHost
    )
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean);

    return {
        resolve: {
            alias: [
                {
                    find: '@/images',
                    replacement: fileURLToPath(
                        new URL('./resources/images', import.meta.url),
                    ),
                },
                {
                    find: '@',
                    replacement: fileURLToPath(
                        new URL('./resources/js', import.meta.url),
                    ),
                },
            ],
        },
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                refresh: true,
            }),
            inertia(),
            react({
                babel: {
                    plugins: ['babel-plugin-react-compiler'],
                },
            }),
            tailwindcss(),
            wayfinder({
                formVariants: true,
            }),
        ],
        ...(command === 'serve'
            ? {
                  server: {
                      host: '0.0.0.0',
                      port: Number(process.env.VITE_DEV_SERVER_PORT ?? 5173),
                      strictPort: true,
                      origin: viteDevServerUrl,
                      allowedHosts: viteDevServerAllowedHosts,
                      hmr: {
                          host: viteDevServerHost,
                          clientPort: viteDevServerClientPort,
                      },
                      cors: {
                          origin: [appUrl],
                      },
                  },
              }
            : {}),
    };
});
