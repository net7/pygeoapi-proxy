<?php

return [
    'allow_guests' => filter_var(env('SUPPORT_ALLOW_GUESTS', false), FILTER_VALIDATE_BOOLEAN),
    'max_attachments' => 3,
    'max_file_kib' => 5120,
    'extensions' => ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'log', 'csv', 'json'],
    'queue' => 'support-mail',
    'retention_seconds' => 7 * 24 * 60 * 60,
    'lock_seconds' => 75,
];
