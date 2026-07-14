<?php

namespace App\Enums\Ogc;

enum ExecutionMode: string
{
    case Sync = 'sync';
    case Async = 'async';

    public function preferHeader(): string
    {
        return match ($this) {
            self::Sync => 'respond-sync',
            self::Async => 'respond-async',
        };
    }
}
