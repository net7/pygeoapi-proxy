<?php

test('admin user badge uses the shadcn badge component and uppercase label', function () {
    $component = file_get_contents(resource_path('js/components/user-info.tsx'));

    expect($component)->toContain("import { Badge } from '@/components/ui/badge';")
        ->and($component)->toContain('ADMIN');
});
