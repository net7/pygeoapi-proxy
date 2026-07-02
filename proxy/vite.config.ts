import { fileURLToPath } from 'node:url';
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig, loadEnv } from 'vite';

const originFromUrl = (url?: string) => {
    if (!url) {
        return null;
    }

    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
};

const envList = (value?: string) =>
    (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appUrl = env.APP_URL ?? 'http://localhost:8088';
    const corsOrigins = [
        originFromUrl(appUrl),
        originFromUrl(env.ORCID_REDIRECT_URI),
        ...envList(env.VITE_DEV_SERVER_CORS_ORIGINS),
    ].filter((origin, index, origins): origin is string => {
        return typeof origin === 'string' && origins.indexOf(origin) === index;
    });
    const viteDevServerUrl = env.VITE_DEV_SERVER_URL ?? 'http://localhost:5174';
    const viteDevServer = new URL(viteDevServerUrl);
    const viteDevServerHost =
        env.VITE_DEV_SERVER_HOST ?? viteDevServer.hostname;
    const viteDevServerClientPort = Number(
        env.VITE_DEV_SERVER_CLIENT_PORT ?? (viteDevServer.port || 5174),
    );
    const viteDevServerAllowedHosts = (
        env.VITE_DEV_SERVER_ALLOWED_HOSTS ?? viteDevServerHost
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
                      port: Number(env.VITE_DEV_SERVER_PORT ?? 5173),
                      strictPort: true,
                      origin: viteDevServerUrl,
                      allowedHosts: viteDevServerAllowedHosts,
                      hmr: {
                          host: viteDevServerHost,
                          clientPort: viteDevServerClientPort,
                      },
                      cors: {
                          origin: corsOrigins,
                      },
                  },
              }
            : {}),
    };
});
