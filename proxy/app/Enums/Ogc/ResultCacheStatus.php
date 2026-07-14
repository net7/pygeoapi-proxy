<?php

namespace App\Enums\Ogc;

enum ResultCacheStatus: string
{
    case MetadataOnly = 'metadata_only';
    case Cached = 'cached';
    case Unsupported = 'unsupported';
    case Failed = 'failed';
}
