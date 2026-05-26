import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
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
                  origin: process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5174',
                  hmr: {
                      host: 'localhost',
                      clientPort: Number(process.env.VITE_DEV_SERVER_CLIENT_PORT ?? 5174),
                  },
                  cors: {
                      origin: [process.env.APP_URL ?? 'http://localhost:8088'],
                  },
              },
          }
        : {}),
}));
