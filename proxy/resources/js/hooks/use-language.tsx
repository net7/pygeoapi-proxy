import { useSyncExternalStore } from 'react';
import {
    defaultLanguage,
    isLanguage,
    languageToLocale,
    normalizeLanguage,
} from '@/lib/i18n/languages';
import type { Language } from '@/lib/i18n/languages';

export type UseLanguageReturn = {
    readonly language: Language;
    readonly locale: string;
    readonly updateLanguage: (language: Language) => void;
};

const listeners = new Set<() => void>();
let currentLanguage: Language = defaultLanguage;

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const prefix = `${name}=`;
    const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
};

const localStorageLanguage = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.localStorage.getItem('language');
    } catch {
        return null;
    }
};

const storeLanguage = (language: Language): void => {
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem('language', language);
        } catch {
            //
        }
    }

    setCookie('language', language);
};

const applyLanguage = (language: Language): void => {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.lang = language;
};

const initialLanguage = (): Language => {
    const storedLanguage = localStorageLanguage();

    if (isLanguage(storedLanguage)) {
        return storedLanguage;
    }

    const cookieLanguage = getCookie('language');

    if (isLanguage(cookieLanguage)) {
        return cookieLanguage;
    }

    if (
        typeof document !== 'undefined' &&
        isLanguage(document.documentElement.lang)
    ) {
        return document.documentElement.lang;
    }

    return defaultLanguage;
};

export function initializeLanguage(): void {
    currentLanguage = normalizeLanguage(initialLanguage());
    storeLanguage(currentLanguage);
    applyLanguage(currentLanguage);
}

export function useLanguage(): UseLanguageReturn {
    const language = useSyncExternalStore(
        subscribe,
        () => currentLanguage,
        () => defaultLanguage,
    );

    const updateLanguage = (nextLanguage: Language): void => {
        currentLanguage = normalizeLanguage(nextLanguage);
        storeLanguage(currentLanguage);
        applyLanguage(currentLanguage);
        notify();
    };

    return {
        language,
        locale: languageToLocale(language),
        updateLanguage,
    } as const;
}
