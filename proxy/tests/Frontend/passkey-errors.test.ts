import { describe, expect, test } from 'bun:test';
import { passkeyErrorMessage } from '../../resources/js/lib/passkey-errors';

describe('passkey error localization', () => {
    test.each([
        [
            'NotSupportedError',
            'Le passkey non sono supportate in questo browser.',
            'Passkeys are not supported in this browser.',
        ],
        [
            'UserCancelledError',
            'L’operazione con la passkey è stata annullata.',
            'The passkey operation was cancelled.',
        ],
        [
            'PasskeyExistsError',
            'Questo dispositivo è già registrato come passkey.',
            'This device is already registered as a passkey.',
        ],
        [
            'InvalidDomainError',
            'Le passkey non possono essere usate su questo dominio.',
            'Passkeys cannot be used on this domain.',
        ],
    ])('localizes %s by error type', (name, italian, english) => {
        const error = Object.assign(new Error('Library message'), { name });
        expect(passkeyErrorMessage(error, 'it')).toBe(italian);
        expect(passkeyErrorMessage(error, 'en')).toBe(english);
    });

    test('handles empty, transport and server errors', () => {
        expect(passkeyErrorMessage(null, 'it')).toBeUndefined();
        expect(
            passkeyErrorMessage(new Error('Failed to fetch'), 'it'),
        ).toContain('Controlla la connessione');
        expect(
            passkeyErrorMessage(
                new Error('Request failed with status 503'),
                'it',
            ),
        ).toContain('codice 503');
        expect(
            passkeyErrorMessage(new Error('An unknown error occurred.'), 'it'),
        ).toContain('Si è verificato un errore');
        expect(
            passkeyErrorMessage(new Error('La sessione è scaduta.'), 'it'),
        ).toBe('La sessione è scaduta.');
    });
});
