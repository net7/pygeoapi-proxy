# Social Auth With Google And ORCID Design

Date: 2026-06-05

## Goal

Add authentication through Google and ORCID while keeping local Laravel/Fortify
authentication easy to re-enable later. The active policy is social-only: users
can currently register and log in only through enabled external providers.

Email is mandatory for every account. If a provider does not return a trusted,
verified email, the application must collect an email address and verify it with
an email OTP before creating or linking the user.

## Decisions

- Use Google through `socialiteproviders/google`.
- Implement ORCID with a custom OAuth2/OpenID integration.
- Keep `users.email` required and unique.
- Make `users.password` nullable so social-only users can exist without a local
  password while preserving future internal auth support.
- Store provider links in a dedicated `social_accounts` table.
- Automatically link a provider to an existing user when the verified email
  matches `users.email`.
- Use email OTP for pending social logins that need email verification.
- Use email OTP for sensitive confirmations when the user has no local password.
- Use Laravel temporary signed URLs for OTP verification pages.
- Keep feature toggles in `config/fortify.php`, mixing Fortify native features
  and application social-auth features.

## Feature Flags

Do not modify the vendor `Laravel\Fortify\Features` class. Add an application
class such as `App\Support\AuthFeatures`:

```php
use App\Support\AuthFeatures;
use Laravel\Fortify\Features;

'features' => [
    // Future internal auth:
    // Features::registration(),
    // Features::resetPasswords(),
    // Features::passkeys([
    //     'confirmPassword' => true,
    // ]),

    // Current social auth:
    AuthFeatures::google(),
    AuthFeatures::orcid(),
    AuthFeatures::emailOtp(),
],
```

`AuthFeatures` returns stable strings such as `google-auth`, `orcid-auth`, and
`email-otp`. UI, routes, and controllers use these flags to decide what is
available. This keeps the current comment/uncomment workflow already present in
`config/fortify.php`.

## Data Model

### Users

Keep the existing user table conceptually centered on email:

- `email`: required, unique, normalized lowercase.
- `email_verified_at`: set when Google provides a verified email or after local
  OTP verification.
- `password`: nullable. Local-auth users have a hashed password; social-only
  users do not.

### Social Accounts

Add `social_accounts`:

- `id`
- `user_id`
- `provider`
- `provider_user_id`
- `provider_email`
- `provider_email_verified`
- `name`
- `avatar`
- `raw_profile` JSON
- timestamps

Indexes:

- unique `provider, provider_user_id`
- index `user_id`
- optional index `provider_email`

### OTP Challenges

Add `email_otp_challenges`:

- `uuid`
- `email`
- `purpose`
- `code_hash`
- `attempts`
- `expires_at`
- `consumed_at`
- `payload` JSON for pending social profile data
- timestamps

The OTP code is never stored in clear text. The database remains the source of
truth for expiration, attempts, purpose, and consumption.

## Routes

Provider routes:

- `GET /auth/{provider}/redirect`
- `GET /auth/{provider}/callback`

OTP routes:

- `GET /verify/{challenge}` with `signed` middleware
- `POST /verify/{challenge}` to verify the submitted OTP code
- `POST /verify/{challenge}/resend` to resend when allowed

OTP emails use `URL::temporarySignedRoute()` and produce URLs shaped like:

```text
/verify/{uuid}?expires=...&signature=...
```

The signed URL protects the public verification page from tampering. The OTP
record still enforces its own TTL, attempt limit, purpose, and consumed state.

## Backend Components

- `AuthFeatures`: application feature flag helper.
- `SocialAuthController`: provider redirect and callback handling.
- `ProviderProfile`: normalized provider profile DTO.
- `SocialUserResolver`: creates, links, or logs in users from provider data.
- `SocialAccount`: Eloquent model for provider links.
- `EmailOtpService`: creates, sends, verifies, consumes, and rate-limits OTPs.
- `OrcidOAuthClient` or internal provider: handles ORCID authorize, token, and
  userinfo endpoints.

Provider-specific logic should be isolated behind profile normalization so the
account resolution logic does not care whether the source is Google or ORCID.

## Frontend Components

- `auth/login.tsx`: provider-first login page.
- OTP verification page for pending social login and sensitive confirmations.
- Shared Inertia auth props include enabled provider routes and OTP routes.
- Internal login/register/reset links are shown only when native Fortify
  features are enabled.

## Flows

### Provider Login

1. User opens `/login`.
2. The page shows enabled providers from `config('fortify.features')`.
3. User clicks Google or ORCID.
4. App redirects to the provider.
5. Provider redirects back to the callback.
6. Callback normalizes provider profile.

Resolution rules:

- Existing `social_accounts(provider, provider_user_id)`: log in linked user.
- Verified provider email matches an existing user: link provider and log in.
- Verified provider email is new: create user, create social account, log in.
- Missing or untrusted provider email: create OTP challenge, email the signed
  verification link, and wait for local email verification before creating or
  linking the account.

### OTP Completion

1. User opens the signed `/verify/{uuid}` URL from email.
2. The page displays the target email and asks for the OTP code.
3. User submits the code.
4. App checks signature, challenge state, purpose, expiration, attempts, and
   code hash.
5. On success, the challenge is consumed and the pending create/link/login flow
   is completed.

### Sensitive Confirmation

For a user without a local password, sensitive actions use email OTP instead of
password confirmation. For a user with a local password, the standard Fortify
password confirmation flow may remain available.

## Error Handling

- Disabled provider: return 404 or redirect to `/login` with a generic message.
- OAuth denied or cancelled: redirect to `/login` with a non-technical error.
- Invalid OAuth state or callback: clear pending session state and redirect to
  `/login`.
- Provider account already linked to another user: block and show an error; do
  not merge accounts automatically.
- OTP expired or too many attempts: invalidate the challenge and allow resend if
  rate limits permit.
- Invalid signed URL: show a link-expired/error page with a resend path when
  possible.

## Security

- Use OAuth state/session protection.
- Register exact ORCID callback URLs; production ORCID redirect URIs must use
  HTTPS.
- Store provider credentials only in `.env` and `config/services.php`.
- Do not persist provider access tokens unless a future feature requires them.
- Hash OTP codes before storage.
- Rate-limit OTP creation and verification by email and IP.
- Keep raw provider payloads limited to profile metadata needed for audit/debug.
- Regenerate the ORCID client secret that was shared during brainstorming before
  using ORCID in any environment.

## Testing

Feature tests should cover:

- Login page shows only enabled provider/internal auth options.
- Google callback creates a new user when email is verified.
- Google callback links to an existing user by verified email.
- Existing social account logs in directly.
- ORCID or unverified email path creates an OTP challenge.
- Valid OTP completes pending create/link/login.
- Invalid, expired, or over-attempt OTP does not authenticate.
- Signed verification URL is required.
- Sensitive confirmation uses OTP for users without a password.
- Fortify internal auth can remain disabled without exposing password login or
  registration links.

Existing password/register tests should be updated to respect feature flags
rather than assuming Fortify registration or reset routes are always enabled.

## Scope

This design is one implementation slice: social auth, OTP verification, and
feature-gated internal auth compatibility. It does not include profile syncing,
provider token refresh, ORCID record write access, or provider management from
user settings beyond automatic linking during login.
