<?php

test('collapsed sidebar uses the short INGV logo', function () {
    $sidebar = file_get_contents(resource_path('js/components/app-sidebar.tsx'));

    expect($sidebar)
        ->toContain('@/images/ingv-logo-short.png')
        ->toContain('state === \'collapsed\'')
        ->toContain('collapsedLogoSrc={INGV_LOGO_SHORT_IMAGE}');
});
