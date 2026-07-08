<?php

namespace App\Support\Ogc;

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Support\Str;

final class GeoServerName
{
    public static function layer(ProcessExecution $execution, ProcessExecutionResult $result): string
    {
        return self::identifier("pe_{$execution->getKey()}_result_{$result->getKey()}_{$result->title}");
    }

    public static function style(ProcessExecution $execution, ProcessExecutionResult $result): string
    {
        return self::identifier(self::layer($execution, $result).'_style');
    }

    private static function identifier(string $value): string
    {
        $identifier = Str::of($value)
            ->lower()
            ->replaceMatches('/[^a-z0-9_]+/', '_')
            ->replaceMatches('/_+/', '_')
            ->trim('_')
            ->limit(63, '');

        return $identifier->isEmpty() ? 'layer' : $identifier->toString();
    }
}
