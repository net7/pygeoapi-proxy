<?php

namespace App\Services\Ogc;

use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;
use InvalidArgumentException;

class OgcProcessesClient
{
    public function __construct(private HttpFactory $http) {}

    /**
     * @return array<string, mixed>
     */
    public function landingPage(): array
    {
        return $this->getJson('/', ['f' => 'json']);
    }

    /**
     * @return array<string, mixed>
     */
    public function processes(): array
    {
        return $this->getJson('/processes', ['f' => 'json']);
    }

    /**
     * @return array<string, mixed>
     */
    public function process(string $processId): array
    {
        return $this->getJson("/processes/{$processId}", ['f' => 'json']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function execute(string $processId, array $payload, string $prefer): Response
    {
        return $this->request()
            ->withHeader('Prefer', $prefer)
            ->post($this->path("/processes/{$processId}/execution"), $payload)
            ->throw();
    }

    /**
     * @return array<string, mixed>
     */
    public function job(string $jobId): array
    {
        return $this->getJson("/jobs/{$jobId}", ['f' => 'json']);
    }

    public function deleteJob(string $jobId): Response
    {
        return $this->request()
            ->delete($this->path("/jobs/{$jobId}"))
            ->throw();
    }

    public function jobResults(string $jobId): Response
    {
        return $this->request()
            ->get($this->path("/jobs/{$jobId}/results"), ['f' => 'json'])
            ->throw();
    }

    public function downloadResultUrl(string $url): Response
    {
        if (! Str::startsWith($url, ['http://', 'https://'])) {
            return $this->request()
                ->get($this->path($url))
                ->throw();
        }

        if (! $this->isAllowedResultUrl($url)) {
            throw new InvalidArgumentException('Result URL is outside the configured OGC Processes base URL.');
        }

        return $this->request()
            ->get($url)
            ->throw();
    }

    /**
     * @param  array<string, scalar>  $query
     * @return array<string, mixed>
     */
    private function getJson(string $path, array $query = []): array
    {
        return $this->request()
            ->get($this->path($path), $query)
            ->throw()
            ->json();
    }

    private function request(): PendingRequest
    {
        return $this->http
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('services.ogc_processes.timeout', 30))
            ->connectTimeout((int) config('services.ogc_processes.connect_timeout', 5))
            ->retry([100, 250], throw: true);
    }

    private function path(string $path): string
    {
        return $this->baseUrl().'/'.Str::of($path)->trim('/')->toString();
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.ogc_processes.base_url'), '/');
    }

    private function isAllowedResultUrl(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $host = parse_url($url, PHP_URL_HOST);

        if (! in_array($scheme, ['http', 'https'], true) || ! is_string($host) || $host === '') {
            return false;
        }

        return in_array(strtolower($host), $this->allowedResultHosts(), true);
    }

    /**
     * @return array<int, string>
     */
    private function allowedResultHosts(): array
    {
        $configuredHosts = config('services.ogc_processes.result_url_hosts', []);

        if (is_string($configuredHosts)) {
            $configuredHosts = explode(',', $configuredHosts);
        }

        $baseHost = parse_url($this->baseUrl(), PHP_URL_HOST);

        return collect([$baseHost, ...$configuredHosts])
            ->filter(fn (mixed $host): bool => is_string($host) && trim($host) !== '')
            ->map(fn (string $host): string => strtolower(trim($host)))
            ->unique()
            ->values()
            ->all();
    }
}
