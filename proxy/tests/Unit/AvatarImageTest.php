<?php

test('avatar images omit the referrer for external providers', function () {
    $component = file_get_contents(dirname(__DIR__, 2).'/resources/js/components/ui/avatar.tsx');

    expect($component)->toContain('referrerPolicy="no-referrer"');
});

test('profile allows removing any visible avatar', function () {
    $profile = file_get_contents(dirname(__DIR__, 2).'/resources/js/pages/settings/profile.tsx');

    expect($profile)->toContain('{auth.user.avatar && (')
        ->not->toContain('{auth.user.has_custom_avatar && (');
});
