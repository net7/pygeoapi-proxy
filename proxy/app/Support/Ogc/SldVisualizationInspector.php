<?php

namespace App\Support\Ogc;

use App\Models\ProcessExecutionResult;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Storage;

class SldVisualizationInspector
{
    public const HillshadeWithoutColorMap = 'hillshade_without_color_map';

    public function warningForResult(ProcessExecutionResult $sld): ?string
    {
        if (blank($sld->storage_path) || ! Storage::disk('local')->exists($sld->storage_path)) {
            return null;
        }

        return $this->warningForXml(Storage::disk('local')->get($sld->storage_path));
    }

    public function warningForXml(string $xml): ?string
    {
        $document = new DOMDocument;
        $previousUseInternalErrors = libxml_use_internal_errors(true);

        try {
            if (! $document->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING)) {
                return null;
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousUseInternalErrors);
        }

        $xpath = new DOMXPath($document);

        if (! $this->hasNode($xpath, '//*[local-name() = "ShadedRelief"]')) {
            return null;
        }

        $hasExplicitVisualization =
            $this->hasNode($xpath, '//*[local-name() = "ColorMap"]')
            || $this->hasNode($xpath, '//*[local-name() = "ContrastEnhancement"]')
            || $this->hasNode($xpath, '//*[local-name() = "Opacity"]')
            || $this->hasNode($xpath, '//*[@opacity]');

        return $hasExplicitVisualization ? null : self::HillshadeWithoutColorMap;
    }

    private function hasNode(DOMXPath $xpath, string $expression): bool
    {
        $nodes = $xpath->query($expression);

        return $nodes !== false && $nodes->length > 0;
    }
}
