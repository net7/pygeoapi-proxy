<?php

namespace App\Enums\Ogc;

enum ResultCollectionStatus: string
{
    case Pending = 'pending';
    case Collecting = 'collecting';
    case Successful = 'successful';
    case Failed = 'failed';
}
