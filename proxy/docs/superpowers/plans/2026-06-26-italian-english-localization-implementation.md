# Italian English Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a solid Italian/English frontend localization layer with Italian as the default and a language selector under Appearance.

**Architecture:** Build a small internal TypeScript i18n layer that mirrors the existing appearance preference pattern: React external store, `localStorage.language`, cookie sync, typed dictionaries, and a `useTranslation()` hook. Add Laravel middleware to read the cookie, set `app()->setLocale()`, share `language` with Blade/Inertia, then replace hardcoded frontend UI strings with translation keys.

**Tech Stack:** Laravel 13, Inertia React 3, React 19, TypeScript, Tailwind CSS 4, Pest, Vite.

---

## File Structure

- Create `app/Http/Middleware/HandleLanguage.php`: validate `language` cookie, set Laravel locale, share `$language` with Blade.
- Modify `bootstrap/app.php`: do not encrypt `language`; run `HandleLanguage` before `HandleInertiaRequests`.
- Modify `app/Http/Middleware/HandleInertiaRequests.php`: share `language` as an Inertia prop.
- Modify `resources/views/app.blade.php`: use `$language` fallback for `<html lang>`.
- Create `resources/js/lib/i18n/languages.ts`: `Language`, defaults, metadata, locale mapping, guards.
- Create `resources/js/lib/i18n/messages.ts`: typed Italian and English dictionaries.
- Create `resources/js/lib/i18n/translation.ts`: key typing, key lookup, interpolation.
- Create `resources/js/hooks/use-language.tsx`: external store, initialization, localStorage/cookie sync.
- Create `resources/js/hooks/use-translation.ts`: React hook returning `t`, `language`, and locale.
- Modify `resources/js/app.tsx`: initialize language before app render.
- Modify `resources/js/types/global.d.ts`: add shared `language` prop type.
- Modify `resources/js/pages/settings/appearance.tsx`: add language section.
- Create `resources/js/components/language-tabs.tsx`: two-option language control.
- Modify frontend pages/components under `resources/js/{pages,components,layouts,hooks,lib}`: replace visible UI strings with `t(...)`.
- Modify `resources/js/lib/jobs.ts`: expose status translation keys and accept explicit locale/default not-available label where needed.
- Add `tests/Feature/Localization/LanguagePreferenceTest.php`: middleware/default/share tests.
- Add `tests/Frontend/i18n.test.ts`: `bun:test` unit tests for language guards, interpolation, and fallback.
- Modify `tests/Unit/ProcessUiLayoutTest.php`, `tests/Unit/AdminFrontendTest.php`, and related source-inspection tests for translation keys while preserving icon/layout assertions.

---

### Task 1: Backend Language Middleware

**Files:**
- Create: `app/Http/Middleware/HandleLanguage.php`
- Modify: `bootstrap/app.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `resources/views/app.blade.php`
- Create: `tests/Feature/Localization/LanguagePreferenceTest.php`

- [ ] **Step 1: Write failing feature tests**

Create `tests/Feature/Localization/LanguagePreferenceTest.php`:

```php
<?php

use App\Models\User;

test('language defaults to italian', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('valid language cookie sets html language', function () {
    $this->withCookie('language', 'en')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="en"', false);
});

test('invalid language cookie falls back to italian', function () {
    $this->withCookie('language', 'fr')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('inertia shares the current language', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withCookie('language', 'en')
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('language', 'en'));
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `php artisan test --compact tests/Feature/Localization/LanguagePreferenceTest.php`

Expected: fail because the test file or language middleware behavior does not exist yet.

- [ ] **Step 3: Implement middleware and shared prop**

Implement:

```php
final class HandleLanguage
{
    private const DefaultLanguage = 'it';

    /** @var list<string> */
    private const SupportedLanguages = ['it', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $language = $request->cookie('language', self::DefaultLanguage);
        $language = in_array($language, self::SupportedLanguages, true)
            ? $language
            : self::DefaultLanguage;

        app()->setLocale($language);
        View::share('language', $language);

        return $next($request);
    }
}
```

Register it before `HandleInertiaRequests`, add `language` to unencrypted cookies, share `'language' => app()->getLocale()` in `HandleInertiaRequests`, and make Blade render `<html lang="{{ $language ?? str_replace('_', '-', app()->getLocale()) }}">`.

- [ ] **Step 4: Run backend localization tests**

Run: `php artisan test --compact tests/Feature/Localization/LanguagePreferenceTest.php`

Expected: pass.

- [ ] **Step 5: Format PHP**

Run: `vendor/bin/pint --dirty --format agent`

Expected: no formatting errors.

---

### Task 2: TypeScript I18n Foundation

**Files:**
- Create: `resources/js/lib/i18n/languages.ts`
- Create: `resources/js/lib/i18n/messages.ts`
- Create: `resources/js/lib/i18n/translation.ts`
- Create: `resources/js/hooks/use-language.tsx`
- Create: `resources/js/hooks/use-translation.ts`
- Modify: `resources/js/app.tsx`
- Modify: `resources/js/types/global.d.ts`
- Create: `tests/Frontend/i18n.test.ts`

- [ ] **Step 1: Write failing frontend tests**

Create `tests/Frontend/i18n.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { defaultLanguage, languageToLocale, normalizeLanguage } from '@/lib/i18n/languages';
import { translate } from '@/lib/i18n/translation';

describe('i18n', () => {
    test('defaults invalid languages to italian', () => {
        expect(defaultLanguage).toBe('it');
        expect(normalizeLanguage('en')).toBe('en');
        expect(normalizeLanguage('fr')).toBe('it');
        expect(normalizeLanguage(null)).toBe('it');
    });

    test('maps language to intl locale', () => {
        expect(languageToLocale('it')).toBe('it-IT');
        expect(languageToLocale('en')).toBe('en-US');
    });

    test('translates keys and interpolates values', () => {
        expect(translate('it', 'common.save')).toBe('Salva');
        expect(translate('en', 'common.save')).toBe('Save');
        expect(translate('it', 'jobs.pagination', { page: 2, pages: 8 })).toBe('Pagina 2 di 8');
        expect(translate('en', 'jobs.pagination', { page: 2, pages: 8 })).toBe('Page 2 of 8');
    });
});
```

- [ ] **Step 2: Run test/typecheck to verify failure**

Run: `bun test tests/Frontend/i18n.test.ts`

Expected: fail because i18n modules do not exist yet.

- [ ] **Step 3: Implement i18n modules**

Create:

```ts
export type Language = 'it' | 'en';
export const defaultLanguage: Language = 'it';
export const supportedLanguages = ['it', 'en'] as const;
export const languageMetadata = {
    it: { label: 'Italiano', locale: 'it-IT' },
    en: { label: 'English', locale: 'en-US' },
} satisfies Record<Language, { label: string; locale: string }>;
```

Create `messages` with a broad key tree for `common`, `navigation`, `auth`, `settings`, `dashboard`, `processes`, `jobs`, `admin`, `ogc`, and `notifications`. Type English as `satisfies typeof itMessages` to catch missing keys.

Create `translate(language, key, values?)`, `TranslationKey`, and interpolation of `{name}` tokens. Create `useLanguage()` mirroring `useAppearance()` and `useTranslation()` returning `{ t, language, locale, updateLanguage }`.

- [ ] **Step 4: Initialize language**

In `resources/js/app.tsx`, call `initializeLanguage()` before `createInertiaApp()` or before render completion, and keep `initializeTheme()`.

- [ ] **Step 5: Run typecheck**

Run: `bun run types:check`

Run: `bun test tests/Frontend/i18n.test.ts`

Expected: pass or fail only on call sites not converted yet.

---

### Task 3: Appearance Language Selector

**Files:**
- Create: `resources/js/components/language-tabs.tsx`
- Modify: `resources/js/pages/settings/appearance.tsx`
- Modify: `resources/js/components/appearance-tabs.tsx`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Add failing source-inspection assertion**

Extend `tests/Unit/ProcessUiLayoutTest.php` to assert `resources/js/components/language-tabs.tsx` contains `LanguagesIcon`, `updateLanguage`, `Italiano`, `English`, and `cursor-pointer`.

- [ ] **Step 2: Run targeted test**

Run: `php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="interactive button and link surfaces use pointer cursors"`

Expected: fail until `language-tabs.tsx` exists and is included in the requirements.

- [ ] **Step 3: Implement language selector**

Create `LanguageTabs` using `LanguagesIcon`, `useLanguage()`, and the same inline-flex tab pattern as `AppearanceTabs`.

Modify `settings/appearance.tsx` to render translated headings for appearance and language, then render both `AppearanceTabs` and `LanguageTabs`.

- [ ] **Step 4: Translate appearance tabs**

Use `useTranslation()` in `AppearanceTabs` for `settings.appearance.light`, `settings.appearance.dark`, and `settings.appearance.system`.

- [ ] **Step 5: Run targeted test**

Run: `php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="interactive button and link surfaces use pointer cursors"`

Expected: pass.

---

### Task 4: Shared Layout, Navigation, Auth, And Settings Translation

**Files:**
- Modify: `resources/js/layouts/**/*.tsx`
- Modify: `resources/js/components/{app-sidebar,nav-main,nav-footer,nav-user,user-menu-content,breadcrumbs,delete-user,manage-passkeys,passkey-register,passkey-item,passkey-verify,status-notice,input-error}.tsx`
- Modify: `resources/js/pages/auth/*.tsx`
- Modify: `resources/js/pages/settings/{profile,security}.tsx`
- Modify: `resources/js/pages/dashboard.tsx`
- Modify: `resources/js/lib/page-title.ts`
- Modify: source-inspection tests that expect English labels.

- [ ] **Step 1: Convert shared layout strings**

Use `useTranslation()` in layouts and navigation components. Keep route labels in config arrays as translation keys, not rendered English strings.

- [ ] **Step 2: Convert auth pages**

Replace auth page titles, labels, descriptions, buttons, placeholders, and links with translation keys. Keep provider labels from backend untouched.

- [ ] **Step 3: Convert settings profile/security pages and related components**

Translate headings, form labels, descriptions, destructive-account dialogs, passkey actions, and status notices.

- [ ] **Step 4: Convert dashboard and page title helpers**

Translate dashboard copy and make page title input come from translated page `<Head title={...} />` values.

- [ ] **Step 5: Run checks**

Run: `bun run types:check`

Run: `php artisan test --compact tests/Feature/Auth tests/Feature/Settings tests/Feature/DashboardTest.php tests/Unit/ProcessUiLayoutTest.php`

Expected: pass after source-inspection tests are updated to key-based assertions where needed.

---

### Task 5: Processes, Jobs, OGC Components, And Date Locale

**Files:**
- Modify: `resources/js/pages/processes/{index,show}.tsx`
- Modify: `resources/js/pages/process-executions/{index,show}.tsx`
- Modify: `resources/js/components/ogc/*.tsx`
- Modify: `resources/js/lib/jobs.ts`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Refactor job helpers for localization**

Keep status style classes/icons in `jobStatusStyles()`, but move rendered labels to translation keys or accept translated labels at call sites. Change `formatJobDate()` to receive locale and unavailable label from `useTranslation()`.

- [ ] **Step 2: Translate process list/detail pages**

Translate process cards, empty states, headings, badges, action buttons, and process metadata labels. Leave process names/descriptions from OGC data untouched.

- [ ] **Step 3: Translate job list/detail pages**

Translate filters, table headers, pagination, empty states, status labels, result/download actions, and job metadata labels. Leave job ids, remote ids, payloads, and backend messages untouched.

- [ ] **Step 4: Translate OGC dynamic form components**

Translate execution controls, output selectors, array/object field labels, add/remove row actions, helper text controlled by the app, and local development prefill action.

- [ ] **Step 5: Run process/job tests**

Run: `bun run types:check`

Run: `php artisan test --compact tests/Feature/Ogc tests/Unit/ProcessUiLayoutTest.php`

Expected: pass after updating string assertions to translation-key-aware checks.

---

### Task 6: Admin Translation

**Files:**
- Modify: `resources/js/pages/admin/users/index.tsx`
- Modify: `resources/js/pages/admin/jobs/index.tsx`
- Modify: `tests/Unit/AdminFrontendTest.php`
- Modify: `tests/Feature/Admin/*.php` only if rendered string assertions require it.

- [ ] **Step 1: Translate admin users page**

Translate headings, filters, table headers, role/status labels, modal titles/descriptions, confirmation copy, and action buttons. Keep names, emails, role values, and job identifiers from backend untouched unless rendered as a UI label.

- [ ] **Step 2: Translate admin jobs page**

Translate headings, filters, table headers, empty states, status labels, and action buttons. Keep process names, user names/emails, and job identifiers untouched.

- [ ] **Step 3: Update admin source tests**

Update source-inspection tests to assert structure, translation keys, icons, and controls rather than hardcoded English UI copy.

- [ ] **Step 4: Run admin tests**

Run: `bun run types:check`

Run: `php artisan test --compact tests/Feature/Admin tests/Unit/AdminFrontendTest.php`

Expected: pass.

---

### Task 7: Final String Scan And Verification

**Files:**
- Modify any remaining frontend files with user-visible hardcoded English strings.

- [ ] **Step 1: Scan for remaining hardcoded UI strings**

Run:

```bash
rg -n "('[A-Z][^']{2,}'|\"[A-Z][^\"]{2,}\")" resources/js/pages resources/js/components resources/js/layouts resources/js/hooks resources/js/lib
```

Expected: remaining matches are translation dictionaries, CSS/classes, import paths, enum values, technical constants, provider names, or non-visible identifiers.

- [ ] **Step 2: Run full frontend checks**

Run: `bun run types:check`

Expected: pass.

- [ ] **Step 3: Run focused backend/Pest suite**

Run:

```bash
php artisan test --compact tests/Feature/Localization tests/Feature/Auth tests/Feature/Settings tests/Feature/DashboardTest.php tests/Feature/Admin tests/Feature/Ogc tests/Unit/ProcessUiLayoutTest.php tests/Unit/AdminFrontendTest.php
```

Expected: pass.

- [ ] **Step 4: Format changed files**

Run: `vendor/bin/pint --dirty --format agent`

Run: `bun run format:check`

Expected: pass after formatting, or run `bun run format` if frontend formatting differs.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git status --short
git add app bootstrap resources tests docs/superpowers/plans/2026-06-26-italian-english-localization-implementation.md
git commit -m "Add Italian and English localization"
```

Expected: commit succeeds with all implementation changes.
