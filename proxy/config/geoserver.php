<?php

return [
    'enabled' => env('GEOSERVER_ENABLED', true),
    'internal_url' => rtrim((string) env('GEOSERVER_INTERNAL_URL', 'http://geoserver:8080/geoserver'), '/'),
    'public_url' => rtrim((string) env('GEOSERVER_PUBLIC_URL', 'http://localhost:8091/geoserver'), '/'),
    'username' => env('GEOSERVER_USERNAME', 'admin'),
    'password' => env('GEOSERVER_PASSWORD', 'geoserver'),
    'workspace' => env('GEOSERVER_WORKSPACE', 'pygeoapi_proxy'),
    'tile_timeout' => (int) env('GEOSERVER_TILE_TIMEOUT', 30),
    'rest_timeout' => (int) env('GEOSERVER_REST_TIMEOUT', 30),
];
