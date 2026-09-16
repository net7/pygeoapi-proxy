import type { Language } from '@/lib/i18n/languages';
import { translate } from '@/lib/i18n/translation';

const errorKeys = {
    NotSupportedError: 'settings.passkeys.notSupported',
    UserCancelledError: 'settings.passkeys.cancelled',
    PasskeyExistsError: 'settings.passkeys.alreadyRegistered',
    InvalidDomainError: 'settings.passkeys.invalidDomain',
} as const;

export function passkeyErrorMessage(
    error: Error | null,
    language: Language,
): string | undefined {
    if (!error) {
        return undefined;
    }

    const key = errorKeys[error.name as keyof typeof errorKeys];

    if (key) {
        return translate(language, key);
    }

    if (error.message === 'An unknown error occurred.') {
        return translate(language, 'settings.passkeys.unknownError');
    }

    if (
        [
            'Failed to fetch',
            'Load failed',
            'NetworkError when attempting to fetch resource.',
        ].includes(error.message)
    ) {
        return translate(language, 'settings.passkeys.networkError');
    }

    const requestFailure = /^Request failed with status (\d+)$/.exec(
        error.message,
    );

    if (requestFailure) {
        return translate(language, 'settings.passkeys.requestFailed', {
            status: requestFailure[1],
        });
    }

    return error.message;
}
