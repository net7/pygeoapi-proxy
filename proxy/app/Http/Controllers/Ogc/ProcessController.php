<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Support\Facades\App;
use Inertia\Inertia;
use Inertia\Response;

class ProcessController extends Controller
{
    public function __construct(
        private OgcProcessCache $cache,
        private OgcProcessCacheWarmupDispatcher $warmupDispatcher,
        private ProcessSchemaNormalizer $normalizer,
    ) {}

    public function index(): Response
    {
        $catalog = $this->cache->catalog();

        if (! $this->cache->hasFreshCatalog()) {
            $this->warmupDispatcher->dispatchForCacheMiss();
        }

        return Inertia::render('processes/index', [
            'catalogStatus' => $catalog === null ? 'warming' : 'ready',
            'catalogLastUpdatedAt' => $this->cache->catalogLastUpdatedAt(),
            'processes' => $catalog['processes'] ?? [],
        ]);
    }

    public function show(string $process): Response
    {
        $description = $this->cache->process($process);

        if (! $this->cache->hasFreshProcess($process)) {
            $this->warmupDispatcher->dispatchForCacheMiss();
        }

        if ($description === null) {
            return Inertia::render('processes/show', [
                'process' => null,
                'processStatus' => 'warming',
                'processLastUpdatedAt' => null,
                'formSchema' => null,
            ]);
        }

        $formSchema = $this->normalizer->normalize($description);
        $formSchema['examplePayload'] = App::environment(['local', 'development'])
            ? $this->examplePayload($description)
            : null;

        return Inertia::render('processes/show', [
            'process' => $description,
            'processStatus' => 'ready',
            'processLastUpdatedAt' => $this->cache->processLastUpdatedAt($process),
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
