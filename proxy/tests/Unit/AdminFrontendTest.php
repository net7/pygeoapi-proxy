<?php

test('admin user badge uses the shadcn badge component and uppercase label', function () {
    $component = file_get_contents(dirname(__DIR__, 2).'/resources/js/components/user-info.tsx');

    expect($component)->toContain("import { Badge } from '@/components/ui/badge';")
        ->and($component)->toContain('variant="destructive"')
        ->and($component)->toContain('ADMIN');
});

test('admin sidebar groups all users and all jobs under administration', function () {
    $sidebar = file_get_contents(dirname(__DIR__, 2).'/resources/js/components/app-sidebar.tsx');

    expect($sidebar)->toContain("label={t('navigation.administration')}")
        ->and($sidebar)->toContain("title: 'All Users'")
        ->and($sidebar)->toContain("titleKey: 'navigation.allUsers'")
        ->and($sidebar)->toContain("title: 'All Jobs'")
        ->and($sidebar)->toContain("titleKey: 'navigation.allJobs'")
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
        ->and($users)->toContain('admin.allUsers')
        ->and($users)->toContain("variant={role === 'admin' ? 'destructive' : 'outline'}")
        ->and($users)->toContain("role === 'user' && 'bg-background'")
        ->and($users)->toContain('roleLabel(role, t).toUpperCase()')
        ->and($users)->toContain('admin.statusInactive')
        ->and($users)->toContain('admin.statusActive')
        ->and($users)->toContain("socialProviders: 'admin.registeredWith'")
        ->and($users)->toContain('titleKey="admin.registeredWith"')
        ->and($users)->toContain("jobs_count: 'admin.userJobs'")
        ->and($users)->toContain('titleKey="admin.userJobs"')
        ->and($users)->toContain("t('admin.viewUserJobs')")
        ->and($users)->not->toContain('titleKey="jobs.title"')
        ->and($users)->not->toContain("t('jobs.title')")
        ->and($users)->toContain('SocialProviderBadges')
        ->and($users)->toContain('provider.label.toUpperCase()')
        ->and($users)->toContain("from '@/components/social-provider-icon'")
        ->and($users)->toContain('SocialProviderIcon')
        ->and($users)->toContain('getSocialProviderStyle')
        ->and($users)->toContain('admin.local')
        ->and($users)->toContain('data-icon="inline-start"')
        ->and($users)->toContain('border-emerald-200 bg-emerald-100 text-emerald-800 uppercase')
        ->and($users)->toContain('jobsIndex({')
        ->and($users)->toContain('query: { user: user.jobFilter }')
        ->and($users)->not->toContain('query: { user_id: user.id }')
        ->and($users)->toContain('border-sky-200 bg-sky-50 text-sky-800')
        ->and($users)->toContain('border-amber-200 bg-amber-50 text-amber-900')
        ->and($users)->toContain('border-emerald-200 bg-emerald-50 text-emerald-800')
        ->and($users)->toContain('admin.restore')
        ->and($users)->toContain('admin.deactivate')
        ->and($users)->toContain("from '@/components/ui/popover'")
        ->and($users)->toContain('<PopoverTrigger asChild>')
        ->and($users)->toContain('aria-disabled={isSelf}')
        ->and($users)->toContain('admin.userSelfStatusUnavailable')
        ->and($users)->toContain("from '@/components/ui/avatar'")
        ->and($users)->toContain('AdminUserIdentity')
        ->and($users)->toContain('<AvatarImage src={user.avatar ?? undefined} alt={user.name} />')
        ->and($jobs)->toContain("from '@tanstack/react-table'")
        ->and($jobs)->toContain('getFilteredRowModel')
        ->and($jobs)->toContain("user: 'common.user'")
        ->and($jobs)->toContain('admin.allUsers')
        ->and($jobs)->toContain('selectedUserId')
        ->and($jobs)->toContain('user: nextUser.jobFilter')
        ->and($jobs)->not->toContain('user_id')
        ->and($jobs)->toContain('admin.jobsByUser')
        ->and($jobs)->not->toContain('Owner')
        ->and($jobs)->toContain('styles.rowClassName')
        ->and($jobs)->toContain("from '@/components/ui/avatar'")
        ->and($jobs)->toContain('AdminJobUserIdentity')
        ->and($jobs)->toContain('<AvatarImage src={owner.avatar ?? undefined} alt={owner.name} />');
});

test('admin edit user modal explains email reconciliation and requires confirmation', function () {
    $source = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/users/index.tsx');

    expect($source)
        ->toContain('email_confirmation')
        ->toContain('admin.confirmEmail')
        ->toContain('admin.editUserDetails')
        ->toContain("'bg-muted text-muted-foreground'")
        ->toContain('className="px-6"')
        ->toContain('w-full max-w-full min-w-0')
        ->toContain('[&>svg]:size-5')
        ->toContain('InfoIcon className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-300"')
        ->toContain('border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100 [&>svg]:size-5')
        ->toContain('admin.socialReconciliation')
        ->toContain('admin.providerLinked')
        ->toContain('admin.providerEmail')
        ->toContain('admin.noTrustedProviderEmail')
        ->toContain('admin.emailChanged')
        ->toContain('admin.emailAlreadyUsed')
        ->not->toContain('border-sky-100 bg-sky-50/70')
        ->not->toContain('mx-6 border-sky-200');
});

test('admin user status modal uses contextual confirmation panels', function () {
    $source = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/admin/users/index.tsx');

    expect($source)
        ->toContain('UserCheckIcon')
        ->toContain('const StatusIcon = isRestoring ? UserCheckIcon : UserXIcon;')
        ->toContain('data-icon="dialog-status"')
        ->toContain('border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100')
        ->toContain('border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100')
        ->toContain('admin.statusRestoreDescription')
        ->toContain('admin.statusDeactivateDescription')
        ->toContain('status-user-name')
        ->toContain('status-user-email')
        ->toContain('font-semibold')
        ->toContain('font-mono text-xs')
        ->toContain('italic opacity-75');
});
