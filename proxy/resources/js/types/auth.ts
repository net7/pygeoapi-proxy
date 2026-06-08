export type User = {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    has_custom_avatar: boolean;
    email_verified_at: string | null;
    has_local_password: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type PasskeyRoutePair = {
    options: string;
    submit: string;
};

export type PasskeyManagementRoutes = PasskeyRoutePair & {
    destroy: string;
};

export type SocialProviderRoute = {
    provider: string;
    label: string;
    redirect: string;
};

export type Auth = {
    user: User | null;
    canRegister: boolean;
    canResetPassword: boolean;
    canUsePasskeys: boolean;
    canUsePasswordLogin: boolean;
    routes: {
        register: string | null;
        passwordRequest: string | null;
        passkeyLogin: PasskeyRoutePair | null;
        socialProviders: SocialProviderRoute[];
        sensitiveConfirmation: string | null;
    };
};

/* @chisel-passkeys */
export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
/* @end-chisel-passkeys */
