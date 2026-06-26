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
        ->and($users)->toContain('border-emerald-200 bg-emerald-100 text-emerald-800 uppercase')
        ->and($users)->toContain('jobsIndex({')
        ->and($users)->toContain('query: { user: user.jobFilter }')
        ->and($users)->not->toContain('query: { user_id: user.id }')
        ->and($users)->toContain('border-sky-200 bg-sky-50 text-sky-800')
        ->and($users)->toContain('border-amber-200 bg-amber-50 text-amber-900')
        ->and($users)->toContain('border-emerald-200 bg-emerald-50 text-emerald-800')
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
