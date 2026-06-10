<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'orcid' => [
        'client_id' => env('ORCID_CLIENT_ID'),
        'client_secret' => env('ORCID_CLIENT_SECRET'),
        'redirect' => env('ORCID_REDIRECT_URI'),
        'base_url' => env('ORCID_BASE_URL', 'https://orcid.org'),
        'scope' => env('ORCID_SCOPE', 'openid'),
    ],

    'ogc_processes' => [
        'base_url' => env('OGC_PROCESSES_BASE_URL', 'https://voice.pi.ingv.it/geoinquire/'),
        'timeout' => (int) env('OGC_PROCESSES_TIMEOUT', 30),
        'connect_timeout' => (int) env('OGC_PROCESSES_CONNECT_TIMEOUT', 5),
        'cache_ttl' => (int) env('OGC_PROCESSES_CACHE_TTL', 300),
        'binary_cache_ttl_days' => (int) env('OGC_PROCESSES_BINARY_CACHE_TTL_DAYS', 30),
        'polling_interval' => (int) env('OGC_PROCESSES_POLLING_INTERVAL', 5000),
        'input_references' => [
            // 'process_id' => [
            //     'input_id' => [
            //         ['label' => 'Dataset name', 'href' => 'https://example.test/input.csv', 'mediaType' => 'text/csv'],
            //     ],
            // ],
        ],
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
