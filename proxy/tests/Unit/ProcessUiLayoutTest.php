<?php

test('process form keeps inputs beside execution controls on desktop', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain('lg:grid-cols-[minmax(0,1fr)_22rem]')
        ->toContain('lg:sticky')
        ->toContain('Execution')
        ->toContain('Outputs');
});

test('array table fields keep a practical responsive width', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/array-table-field.tsx');

    expect($source)
        ->toContain('tableMinWidth')
        ->toContain('overflow-x-auto rounded-md border')
        ->not->toContain('min-w-[960px]');
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

test('execution detail prioritizes results and keeps request payload beside them', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');

    expect($source)
        ->toContain('xl:grid-cols-[minmax(0,1fr)_24rem]')
        ->toContain('Results')
        ->toContain('Request Payload');
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
