<?php

namespace App\Enums\Ogc;

enum MapLayerStatus: string
{
    case Pending = 'pending';
    case Publishing = 'publishing';
    case Published = 'published';
    case Failed = 'failed';
}
