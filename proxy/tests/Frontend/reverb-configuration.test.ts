import { describe, expect, test } from 'bun:test';

import { reverbOptions } from '../../resources/js/lib/reverb-configuration';

describe('runtime Reverb configuration', () => {
    test('keeps Echo defaults when runtime configuration is absent', () => {
        expect(reverbOptions(null)).toEqual({ broadcaster: 'reverb' });
    });

    test.each(['public_app.example.test', 'renamed-ui.example.test'])(
        'uses the public host %s from the page instead of build settings',
        (host) => {
            const options = reverbOptions(
                JSON.stringify({
                    key: 'public-websocket-key',
                    host,
                    port: 443,
                    scheme: 'https',
                }),
            );

            expect(options).toEqual({
                broadcaster: 'reverb',
                key: 'public-websocket-key',
                wsHost: host,
                wsPort: 443,
                wssPort: 443,
                forceTLS: true,
                enabledTransports: ['ws', 'wss'],
            });
        },
    );

    test('supports an explicit HTTP websocket port for local environments', () => {
        const options = reverbOptions(
            JSON.stringify({
                key: 'local-key',
                host: 'localhost',
                port: 8081,
                scheme: 'http',
            }),
        );

        expect(options.wsHost).toBe('localhost');
        expect(options.wsPort).toBe(8081);
        expect(options.wssPort).toBe(8081);
        expect(options.forceTLS).toBe(false);
    });
});
