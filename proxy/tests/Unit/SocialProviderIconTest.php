<?php

test('social provider icons are shared between login and admin user surfaces', function () {
    $helperPath = getcwd().'/resources/js/components/social-provider-icon.tsx';
    $helper = file_exists($helperPath) ? file_get_contents($helperPath) : '';
    $login = file_get_contents(getcwd().'/resources/js/pages/auth/login.tsx');
    $adminUsers = file_get_contents(getcwd().'/resources/js/pages/admin/users/index.tsx');

    expect($helper)
        ->toContain("from 'react-icons/fa'")
        ->toContain("from 'react-icons/si'")
        ->toContain('SiGoogle')
        ->toContain('SiOrcid')
        ->toContain('SiOpenid')
        ->toContain('SocialProviderIcon')
        ->toContain('getSocialProviderStyle')
        ->and($login)
        ->toContain("from '@/components/social-provider-icon'")
        ->toContain('SocialProviderIcon')
        ->not->toContain('function GoogleLogo')
        ->not->toContain('function OrcidLogo')
        ->not->toContain('<svg viewBox="0 0 24 24"')
        ->and($adminUsers)
        ->toContain("from '@/components/social-provider-icon'")
        ->toContain('SocialProviderIcon')
        ->toContain('getSocialProviderStyle')
        ->not->toContain("from 'react-icons/si'")
        ->not->toContain("from 'react-icons/fa'");
});

test('external link glyphs use react icons instead of duplicated inline svg', function () {
    $welcome = file_get_contents(getcwd().'/resources/js/pages/welcome.tsx');

    expect($welcome)
        ->toContain("from 'react-icons/fi'")
        ->toContain('FiExternalLink')
        ->toContain('data-icon="inline-end"')
        ->not->toContain('d="M7.70833 6.95834V2.79167H3.54167M2.5 8L7.5 3.00001"');
});
