<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Support\Facades\App;
use Inertia\Inertia;
use Inertia\Response;

class ProcessController extends Controller
{
    public function __construct(
        private OgcProcessCache $cache,
        private ProcessSchemaNormalizer $normalizer,
    ) {}

    public function index(): Response
    {
        $catalog = $this->cache->catalog();

        return Inertia::render('processes/index', [
            'catalogStatus' => $catalog === null ? 'warming' : 'ready',
            'processes' => $catalog['processes'] ?? [],
        ]);
    }

    public function show(string $process): Response
    {
        $description = $this->cache->process($process);

        if ($description === null) {
            return Inertia::render('processes/show', [
                'process' => null,
                'processStatus' => 'warming',
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
