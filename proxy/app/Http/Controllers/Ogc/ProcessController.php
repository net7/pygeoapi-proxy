<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use App\Services\Ogc\ProcessExecutionInputPrefill;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProcessController extends Controller
{
    public function __construct(
        private OgcProcessCache $cache,
        private OgcProcessCacheWarmupDispatcher $warmupDispatcher,
        private ProcessSchemaNormalizer $normalizer,
        private ProcessExecutionInputPrefill $inputPrefill,
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

    public function show(Request $request, string $process): Response
    {
        $sourceExecution = $this->sourceExecution($request, $process);
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
                'inputPrefill' => null,
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
            'inputPrefill' => $sourceExecution === null
                ? null
                : $this->inputPrefill->build(
                    $sourceExecution,
                    $formSchema['fields'],
                ),
        ]);
    }

    private function sourceExecution(Request $request, string $process): ?ProcessExecution
    {
        if (! $request->filled('sourceJob')) {
            return null;
        }

        $sourceJobId = $request->integer('sourceJob');

        abort_if($sourceJobId < 1, 404);

        $sourceExecution = ProcessExecution::query()->findOrFail($sourceJobId);

        Gate::authorize('view', $sourceExecution);
        abort_unless($sourceExecution->process_id === $process, 404);

        return $sourceExecution;
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
