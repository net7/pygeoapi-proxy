import { App } from '@inertiajs/react';
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from '../../resources/js/pages/auth/login';

function renderLogin(email: string | null, passwordLogin = true): string {
    return renderToStaticMarkup(
        <App
            initialPage={{
                component: 'auth/login',
                url: '/login',
                version: null,
                clearHistory: false,
                encryptHistory: false,
                props: {
                    errors: {},
                    auth: {
                        canUsePasswordLogin: passwordLogin,
                        routes: {
                            passkeyLogin: null,
                            register: null,
                            socialProviders: passwordLogin
                                ? []
                                : [
                                      {
                                          provider: 'google',
                                          label: 'Google',
                                          redirect: '/auth/google/redirect',
                                      },
                                  ],
                        },
                    },
                },
            }}
            initialComponent={() => (
                <Login canResetPassword={false} supportContactEmail={email} />
            )}
        />,
    );
}

test.each([true, false])(
    'login offers an email link below the sign-in controls with password login %s',
    (passwordLogin) => {
        const html = renderLogin('technical@example.org', passwordLogin);

        expect(html).toContain(
            'Trouble signing in? Email the technical contact:',
        );
        expect(html).toContain('href="mailto:technical@example.org"');
        expect(html.indexOf('mailto:technical@example.org')).toBeGreaterThan(
            html.indexOf(passwordLogin ? '</form>' : '</section>'),
        );
    },
);

test('login omits the email help when the server provides no contact', () => {
    const html = renderLogin(null);

    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('Trouble signing in?');
});
