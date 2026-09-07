import type { EchoOptions } from 'laravel-echo';

type PublicReverbConfiguration = {
    key: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
};

export function reverbOptions(
    configuration: string | null,
): EchoOptions<'reverb'> {
    if (!configuration) {
        return { broadcaster: 'reverb' };
    }

    const { key, host, port, scheme } = JSON.parse(
        configuration,
    ) as PublicReverbConfiguration;

    return {
        broadcaster: 'reverb',
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
    };
}
