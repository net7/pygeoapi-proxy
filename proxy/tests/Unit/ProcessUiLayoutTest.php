<?php

test('process form keeps inputs beside execution controls on desktop', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain('lg:grid-cols-[minmax(0,1fr)_22rem]')
        ->toContain('lg:sticky')
        ->toContain('@/routes/processes/jobs')
        ->toContain('Execution')
        ->toContain('Outputs');
});

test('process form exposes a local development prefill action', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain('examplePayload')
        ->toContain('PREFILL TEST DATA')
        ->toContain('bg-amber-100')
        ->toContain('applyExamplePayload')
        ->toContain('WandSparklesIcon')
        ->toContain('data-icon="inline-start"');
});

test('decimal process number inputs are valid after prefill', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/schema-field-renderer.tsx');

    expect($source)
        ->toContain("step={field.type === 'number' ? 'any' : undefined}");
});

test('array table fields keep a practical responsive width', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/array-table-field.tsx');

    expect($source)
        ->toContain('tableMinWidth')
        ->toContain('overflow-x-auto rounded-md border')
        ->not->toContain('min-w-[960px]');
});

test('text buttons include representative icons', function () {
    $requirements = [
        'resources/js/pages/process-executions/index.tsx' => ['Details' => 'ListChecksIcon'],
        'resources/js/pages/auth/login.tsx' => ['Log in' => 'LogInIcon'],
        'resources/js/pages/auth/register.tsx' => ['Create account' => 'UserPlusIcon'],
        'resources/js/pages/auth/forgot-password.tsx' => ['Email password reset link' => 'MailIcon'],
        'resources/js/pages/auth/reset-password.tsx' => ['Reset password' => 'KeyRoundIcon'],
        'resources/js/pages/auth/confirm-password.tsx' => ['Confirm password' => 'ShieldCheckIcon'],
        'resources/js/pages/settings/profile.tsx' => ['Save' => 'SaveIcon'],
        'resources/js/pages/settings/security.tsx' => ['Save' => 'ShieldCheckIcon'],
        'resources/js/components/delete-user.tsx' => [
            'Cancel' => 'XIcon',
            'Delete account' => 'Trash2Icon',
            'Send confirmation code' => 'MailCheckIcon',
        ],
        'resources/js/components/passkey-register.tsx' => [
            'Add passkey' => 'KeyRoundIcon',
            'Register passkey' => 'KeyRoundIcon',
            'Cancel' => 'XIcon',
        ],
        'resources/js/components/passkey-item.tsx' => [
            'Cancel' => 'XIcon',
            'Remove passkey' => 'Trash2',
        ],
        'resources/js/components/ogc/dynamic-process-form.tsx' => ['Execute' => 'PlayIcon'],
    ];

    foreach ($requirements as $path => $expectedIcons) {
        $source = file_get_contents(getcwd().'/'.$path);

        foreach ($expectedIcons as $buttonLabel => $iconName) {
            expect($source)
                ->toContain($buttonLabel)
                ->toContain($iconName)
                ->toContain('data-icon=');
        }
    }
});

test('jobs index exposes filterable status cards', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/jobs.ts');

    expect($source)
        ->toContain('My Jobs')
        ->toContain('@/routes/jobs')
        ->toContain('ToggleGroup')
        ->toContain('ToggleGroupItem')
        ->toContain('statusOptions')
        ->toContain('filteredExecutions')
        ->toContain('jobStatusStyles')
        ->toContain('formatJobDate')
        ->toContain('createdAt')
        ->toContain('remoteJobId')
        ->toContain('submittedAt')
        ->toContain('completedAt')
        ->toContain('failedAt')
        ->toContain('Badge');

    expect($helperSource)
        ->toContain('SUBMISSION FAILED')
        ->toContain('REMOTE MISSING')
        ->toContain('jobStatusSortIndex');
});

test('remove and delete buttons use destructive styling', function () {
    foreach ([
        'resources/js/components/ogc/array-table-field.tsx',
        'resources/js/components/ogc/array-object-field.tsx',
    ] as $path) {
        expect(file_get_contents(getcwd().'/'.$path))
            ->toContain('aria-label="Remove row"')
            ->toContain('variant="destructive"');
    }

    expect(file_get_contents(getcwd().'/resources/js/components/passkey-item.tsx'))
        ->toContain('variant="destructive"')
        ->toContain('data-icon="icon"')
        ->not->toContain('className="text-destructive hover:bg-destructive/10 hover:text-destructive"')
        ->not->toContain('<Trash2 className=');
});

test('job detail prioritizes results and keeps request data beside them', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');

    expect($source)
        ->toContain('xl:grid-cols-[minmax(0,1fr)_24rem]')
        ->toContain('@/routes/jobs')
        ->toContain('jobStatusStyles')
        ->toContain('Job ID')
        ->toContain('remoteJobId')
        ->toContain('STATUS')
        ->toContain('Requested Outputs')
        ->toContain('Results')
        ->toContain('Request');
});

test('sidebar labels process executions as jobs', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/app-sidebar.tsx');

    expect($source)
        ->toContain("title: 'My Jobs'")
        ->toContain('@/routes/jobs')
        ->not->toContain("title: 'Executions'");
});

test('flash toasts include icons and descriptions', function () {
    $source = file_get_contents(getcwd().'/resources/js/hooks/use-flash-toast.ts');

    expect($source)
        ->toContain('description:')
        ->toContain('icon:')
        ->toContain('getToastIcon');
});

test('auth status messages use the shared notice component', function () {
    foreach ([
        'resources/js/pages/auth/forgot-password.tsx',
        'resources/js/pages/auth/login.tsx',
        'resources/js/pages/auth/social-email.tsx',
        'resources/js/pages/auth/verify-otp.tsx',
        'resources/js/pages/settings/security.tsx',
    ] as $path) {
        expect(file_get_contents(getcwd().'/'.$path))
            ->toContain('StatusNotice')
            ->not->toContain('text-green-600');
    }
});
