<?php

test('application uses INGV favicon assets across browser and Apple surfaces', function () {
    $layout = file_get_contents(resource_path('views/app.blade.php'));
    $faviconSvg = file_get_contents(public_path('favicon.svg'));
    $appleTouchIcon = getimagesize(public_path('apple-touch-icon.png'));

    expect($layout)
        ->toContain('<link rel="icon" href="/favicon.ico?v=ingv" sizes="any">')
        ->toContain('<link rel="icon" href="/favicon.svg?v=ingv" type="image/svg+xml">')
        ->toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=ingv">');

    expect(hash_file('sha256', public_path('favicon.ico')))
        ->toBe('be59ec590101b495290c2470c68e6457bcb2bab6bc794c2a001d249a8972e5d3');

    expect($faviconSvg)
        ->toContain('viewBox="12.56 47.74 98.8 98.8"')
        ->toContain('fill: #00769a;')
        ->not->toContain('#FF2D20');

    expect($appleTouchIcon)->not->toBeFalse();
    expect($appleTouchIcon[0])->toBe(180)
        ->and($appleTouchIcon[1])->toBe(180)
        ->and($appleTouchIcon['mime'])->toBe('image/png');
});
