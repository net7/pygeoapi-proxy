<?php

test('admin user badge uses the shadcn badge component and uppercase label', function () {
    $component = file_get_contents(dirname(__DIR__, 2).'/resources/js/components/user-info.tsx');

    expect($component)->toContain("import { Badge } from '@/components/ui/badge';")
        ->and($component)->toContain('variant="destructive"')
        ->and($component)->toContain('ADMIN');
});

test('admin sidebar groups all users and all jobs under administration', function () {
    $sidebar = file_get_contents(dirname(__DIR__, 2).'/resources/js/components/app-sidebar.tsx');

    expect($sidebar)->toContain('label="Administration"')
        ->and($sidebar)->toContain("title: 'All Users'")
        ->and($sidebar)->toContain("title: 'All Jobs'")
        ->and($sidebar)->toContain('ListChecks')
        ->and($sidebar)->toContain('icon: ListChecks')
        ->and($sidebar)->not->toContain('ShieldCheck')
        ->and($sidebar)->not->toContain("title: 'Admin Users'")
        ->and($sidebar)->not->toContain("title: 'Admin Jobs'");
});

test('admin tables use tanstack filtering and expected labels', function () {
    $users = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/users/index.tsx');
    $jobs = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/jobs/index.tsx');

    expect($users)->toContain("from '@tanstack/react-table'")
        ->and($users)->toContain('getFilteredRowModel')
        ->and($users)->toContain('All Users')
        ->and($users)->toContain("variant={role === 'admin' ? 'destructive' : 'outline'}")
        ->and($users)->toContain("role === 'user' && 'bg-background'")
        ->and($users)->toContain('role.toUpperCase()')
        ->and($users)->toContain('INACTIVE')
        ->and($users)->toContain('ACTIVE')
        ->and($users)->toContain("socialProviders: 'Registered with'")
        ->and($users)->toContain('title="Registered with"')
        ->and($users)->toContain('SocialProviderBadges')
        ->and($users)->toContain('provider.label.toUpperCase()')
        ->and($users)->toContain("from '@/components/social-provider-icon'")
        ->and($users)->toContain('SocialProviderIcon')
        ->and($users)->toContain('getSocialProviderStyle')
        ->and($users)->toContain('LOCAL')
        ->and($users)->toContain('data-icon="inline-start"')
        ->and($users)->toContain('border-emerald-200 bg-emerald-100 text-emerald-800 uppercase')
        ->and($users)->toContain('jobsIndex({')
        ->and($users)->toContain('query: { user: user.jobFilter }')
        ->and($users)->not->toContain('query: { user_id: user.id }')
        ->and($users)->toContain('border-sky-200 bg-sky-50 text-sky-800')
        ->and($users)->toContain('border-amber-200 bg-amber-50 text-amber-900')
        ->and($users)->toContain('border-emerald-200 bg-emerald-50 text-emerald-800')
        ->and($users)->toContain('RESTORE')
        ->and($users)->toContain('DEACTIVATE')
        ->and($users)->toContain("from '@/components/ui/popover'")
        ->and($users)->toContain('<PopoverTrigger asChild>')
        ->and($users)->toContain('aria-disabled={isSelf}')
        ->and($users)->toContain('You cannot change the status of')
        ->and($jobs)->toContain("from '@tanstack/react-table'")
        ->and($jobs)->toContain('getFilteredRowModel')
        ->and($jobs)->toContain("user: 'User'")
        ->and($jobs)->toContain('All users')
        ->and($jobs)->toContain('selectedUserId')
        ->and($jobs)->toContain('user: nextUser.jobFilter')
        ->and($jobs)->not->toContain('user_id')
        ->and($jobs)->toContain('Filter jobs by user')
        ->and($jobs)->not->toContain('Owner')
        ->and($jobs)->toContain('styles.rowClassName');
});

test('admin edit user modal explains email reconciliation and requires confirmation', function () {
    $source = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/users/index.tsx');

    expect($source)
        ->toContain('email_confirmation')
        ->toContain('Confirm email')
        ->toContain('Edit user details')
        ->toContain('[&>svg]:size-5')
        ->toContain('InfoIcon className="mt-0.5 size-5 text-sky-600 dark:text-sky-300"')
        ->toContain('border-sky-200 bg-sky-50 text-sky-950 [&>svg]:size-5 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100')
        ->toContain('How social sign-in reconciliation works')
        ->toContain('Provider identity already linked')
        ->toContain('Verified provider email')
        ->toContain('No trusted provider email')
        ->toContain('Changing this email')
        ->toContain('Email already used');
});

test('admin user status modal uses contextual confirmation panels', function () {
    $source = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/users/index.tsx');

    expect($source)
        ->toContain('UserCheckIcon')
        ->toContain('const StatusIcon = isRestoring ? UserCheckIcon : UserXIcon;')
        ->toContain('data-icon="dialog-status"')
        ->toContain('border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100')
        ->toContain('border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100')
        ->toContain('This user will regain access to the application.')
        ->toContain('This user will immediately lose access to the application.')
        ->toContain('status-user-name')
        ->toContain('status-user-email')
        ->toContain('font-semibold')
        ->toContain('font-mono text-xs italic');
});
