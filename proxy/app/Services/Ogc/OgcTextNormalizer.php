<?php

namespace App\Services\Ogc;

class OgcTextNormalizer
{
    public function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $terminatedEntities = preg_replace(
            '/&(gt|lt)(?=[+-]?\d)/i',
            '&$1;',
            $value,
        ) ?? $value;

        return html_entity_decode(
            $terminatedEntities,
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
        );
    }
}
