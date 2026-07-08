<?php

namespace App\Services\Ogc;

use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use RuntimeException;

class GeoServerClient
{
    public function __construct(private HttpFactory $http) {}

    public function ensureWorkspace(): void
    {
        $workspace = $this->workspace();
        $response = $this->restRequest()->get("/rest/workspaces/{$workspace}.json");

        if ($response->successful()) {
            return;
        }

        if (! $response->notFound()) {
            $this->throwForResponse($response, 'GeoServer workspace lookup failed.');
        }

        $this->ensureSuccessful(
            $this->restRequest()
                ->withBody("<workspace><name>{$workspace}</name></workspace>", 'application/xml')
                ->post('/rest/workspaces'),
            'GeoServer workspace creation failed.',
        );
    }

    public function publishGeoTiff(string $storeName, string $coverageName, string $absoluteGeoTiffPath): void
    {
        $body = file_get_contents($absoluteGeoTiffPath);

        if ($body === false) {
            throw new RuntimeException('GeoTIFF file cannot be read for GeoServer publication.');
        }

        $this->ensureSuccessful(
            $this->restRequest()
                ->withBody($body, 'image/tiff')
                ->put("/rest/workspaces/{$this->workspace()}/coveragestores/{$storeName}/file.geotiff?configure=all&coverageName=".rawurlencode($coverageName)),
            'GeoServer GeoTIFF publication failed.',
        );
    }

    public function uploadStyle(string $styleName, string $absoluteSldPath): void
    {
        $body = file_get_contents($absoluteSldPath);

        if ($body === false) {
            throw new RuntimeException('SLD file cannot be read for GeoServer publication.');
        }

        $styleResponse = $this->restRequest()->get("/rest/workspaces/{$this->workspace()}/styles/{$styleName}.json");

        if (! $styleResponse->successful() && ! $styleResponse->notFound()) {
            $this->throwForResponse($styleResponse, 'GeoServer style lookup failed.');
        }

        if ($styleResponse->notFound()) {
            $this->ensureSuccessful(
                $this->restRequest()
                    ->withBody("<style><name>{$styleName}</name><filename>{$styleName}.sld</filename></style>", 'application/xml')
                    ->post("/rest/workspaces/{$this->workspace()}/styles"),
                'GeoServer style creation failed.',
            );
        }

        $this->ensureSuccessful(
            $this->restRequest()
                ->withBody($body, 'application/vnd.ogc.sld+xml')
                ->put("/rest/workspaces/{$this->workspace()}/styles/{$styleName}"),
            'GeoServer style upload failed.',
        );
    }

    public function assignDefaultStyle(string $layerName, string $styleName): void
    {
        $workspace = $this->workspace();

        $this->ensureSuccessful(
            $this->restRequest()
                ->withBody("<layer><defaultStyle><name>{$styleName}</name><workspace>{$workspace}</workspace></defaultStyle></layer>", 'application/xml')
                ->put("/rest/layers/{$workspace}:{$layerName}"),
            'GeoServer layer style assignment failed.',
        );
    }

    /**
     * @param  array{bbox: string, width: int, height: int}  $tile
     */
    public function getPngTile(string $layerName, array $tile): Response
    {
        return $this->wmsRequest()->get('/wms', [
            'service' => 'WMS',
            'version' => '1.1.1',
            'request' => 'GetMap',
            'layers' => $this->workspace().":{$layerName}",
            'format' => 'image/png',
            'transparent' => 'true',
            'srs' => 'EPSG:3857',
            'bbox' => $tile['bbox'],
            'width' => $tile['width'],
            'height' => $tile['height'],
        ]);
    }

    private function restRequest(): PendingRequest
    {
        return $this->baseRequest()->timeout((int) config('geoserver.rest_timeout', 30));
    }

    private function wmsRequest(): PendingRequest
    {
        return $this->baseRequest()->timeout((int) config('geoserver.tile_timeout', 30));
    }

    private function baseRequest(): PendingRequest
    {
        return $this->http
            ->baseUrl($this->baseUrl())
            ->withBasicAuth((string) config('geoserver.username'), (string) config('geoserver.password'))
            ->connectTimeout(5);
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('geoserver.internal_url'), '/');
    }

    private function workspace(): string
    {
        return (string) config('geoserver.workspace', 'pygeoapi_proxy');
    }

    private function ensureSuccessful(Response $response, string $message): void
    {
        if (in_array($response->status(), [200, 201, 202], true)) {
            return;
        }

        $this->throwForResponse($response, $message);
    }

    private function throwForResponse(Response $response, string $message): never
    {
        throw new RuntimeException($message.' GeoServer responded with HTTP '.$response->status().'.');
    }
}
