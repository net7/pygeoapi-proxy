<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Services\Ogc\OgcProcessesClient;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class ProcessController extends Controller
{
    public function __construct(
        private OgcProcessesClient $client,
        private ProcessSchemaNormalizer $normalizer,
    ) {}

    public function index(): Response
    {
        $catalog = Cache::remember(
            'ogc-processes.catalog',
            (int) config('services.ogc_processes.cache_ttl', 300),
            fn (): array => $this->client->processes(),
        );

        return Inertia::render('processes/index', [
            'processes' => $catalog['processes'] ?? [],
        ]);
    }

    public function show(string $process): Response
    {
        $description = Cache::remember(
            "ogc-processes.process.{$process}",
            (int) config('services.ogc_processes.cache_ttl', 300),
            fn (): array => $this->client->process($process),
        );

        $formSchema = $this->normalizer->normalize($description);
        $formSchema['examplePayload'] = App::environment(['local', 'development'])
            ? $this->examplePayload($description)
            : null;

        return Inertia::render('processes/show', [
            'process' => $description,
            'formSchema' => $formSchema,
        ]);
    }

    /**
     * @param  array<string, mixed>  $description
     * @return array<string, mixed>|null
     */
    private function examplePayload(array $description): ?array
    {
        foreach (['examples', 'example'] as $key) {
            $examples = $description[$key] ?? [];

            if (! is_array($examples)) {
                continue;
            }

            foreach ($examples as $example) {
                if (
                    is_array($example)
                    && isset($example['payload_example'])
                    && is_array($example['payload_example'])
                ) {
                    return $example['payload_example'];
                }
            }
        }

        return null;
    }
}
