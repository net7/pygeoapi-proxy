# OGC Process Cache Warm-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dispatch an asynchronous OGC process cache warm-up when the queue runtime boots, then make process pages read only from cache and show a warming state until the job completes.

**Architecture:** Add a focused `OgcProcessCache` service that owns cache keys, reads, writes, and full warm-up. Add `WarmOgcProcessCacheJob` for queue execution and `OgcProcessCacheWarmupDispatcher` for boot-time dispatch gating. Update `ProcessController` and React pages so process requests never call pygeoapi when cache entries are missing.

**Tech Stack:** Laravel 13, Laravel queue jobs, cache database locks, Inertia React 3, React 19, Pest 4, Pint, TypeScript.

---

## Pre-Implementation Gate

- [ ] **Step 1: Confirm version-specific Laravel docs before code changes**

Use Laravel Boost `search-docs` with these queries:

```text
packages: ["laravel/framework"]
queries:
- "queued jobs middleware without overlapping unique jobs dispatch queue worker artisan context"
- "service provider boot dispatch job queue running in console"
- "cache locks atomic locks"
```

Expected: docs mention service provider `boot()` injection, `app()->runningConsoleCommand()`, queue job middleware `WithoutOverlapping`, and cache atomic locks. If the docs disagree with APIs used below, update this plan before editing code.

## File Structure

- Create: `app/Services/Ogc/OgcProcessCache.php`
  - Owns all OGC process cache keys, cache reads/writes, process id extraction, logging, and warm-up orchestration.
- Create: `app/Jobs/Ogc/WarmOgcProcessCacheJob.php`
  - Queue entrypoint for cache warm-up with retry/backoff and overlap protection.
- Create: `app/Services/Ogc/OgcProcessCacheWarmupDispatcher.php`
  - Decides whether the current console command is a queue runtime and dispatches the job once per short window.
- Modify: `app/Providers/AppServiceProvider.php`
  - Calls the dispatcher after existing application defaults are configured.
- Modify: `app/Http/Controllers/Ogc/ProcessController.php`
  - Reads cache through `OgcProcessCache`; removes lazy remote fetches from request handling.
- Modify: `resources/js/types/ogc.ts`
  - Adds cache status type used by pages.
- Modify: `resources/js/pages/processes/index.tsx`
  - Shows cached list or warming state.
- Modify: `resources/js/pages/processes/show.tsx`
  - Shows cached form or warming state.
- Create: `tests/Unit/Ogc/OgcProcessCacheTest.php`
  - Proves the cache service warms catalog and details and returns null for misses.
- Create: `tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php`
  - Proves the job delegates warm-up and has overlap protection.
- Create: `tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php`
  - Proves queue runtime commands dispatch once and excluded contexts do not dispatch.
- Modify: `tests/Feature/Ogc/ProcessCatalogTest.php`
  - Proves process pages are cache-only and expose warming states.
- Modify: `tests/Unit/ProcessUiLayoutTest.php`
  - Adds source-level assertions for the warming UI.

---

### Task 1: Add The OGC Process Cache Service

**Files:**
- Create: `tests/Unit/Ogc/OgcProcessCacheTest.php`
- Create: `app/Services/Ogc/OgcProcessCache.php`

- [ ] **Step 1: Write the failing service tests**

Create `tests/Unit/Ogc/OgcProcessCacheTest.php`:

```php
<?php

use App\Services\Ogc\OgcProcessCache;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

test('it warms the catalog and every process description', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
        'https://voice.pi.ingv.it/geoinquire/processes/solwcad?f=json' => Http::response(ogcFixture('process-solwcad')),
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
        'https://voice.pi.ingv.it/geoinquire/processes/pybox?f=json' => Http::response(ogcFixture('process-pybox')),
    ]);

    $cache = app(OgcProcessCache::class);

    $cache->warm();

    expect($cache->catalog()['processes'])->toHaveCount(3)
        ->and($cache->process('solwcad')['id'])->toBe('solwcad')
        ->and($cache->process('conduit')['id'])->toBe('conduit')
        ->and($cache->process('pybox')['id'])->toBe('pybox');

    Http::assertSentCount(4);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes?f=json');
});

test('it returns null for missing catalog and process cache entries', function () {
    $cache = app(OgcProcessCache::class);

    expect($cache->catalog())->toBeNull()
        ->and($cache->process('conduit'))->toBeNull();
});

test('it extracts process ids from valid catalog entries only', function () {
    $cache = app(OgcProcessCache::class);

    expect($cache->processIds([
        'processes' => [
            ['id' => 'solwcad'],
            ['id' => ''],
            ['title' => 'Missing id'],
            ['id' => 'conduit'],
            ['id' => 'solwcad'],
            'invalid',
        ],
    ]))->toBe(['solwcad', 'conduit']);
});
```

- [ ] **Step 2: Run the service tests to verify failure**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/OgcProcessCacheTest.php
```

Expected: FAIL because `App\Services\Ogc\OgcProcessCache` does not exist.

- [ ] **Step 3: Implement the cache service**

Create `app/Services/Ogc/OgcProcessCache.php`:

```php
<?php

namespace App\Services\Ogc;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class OgcProcessCache
{
    public const CatalogKey = 'ogc-processes.catalog';

    public const WarmupLockKey = 'ogc-processes.warmup.lock';

    public const WarmupDispatchedKey = 'ogc-processes.warmup.dispatched';

    public function __construct(private OgcProcessesClient $client) {}

    /**
     * @return array<string, mixed>|null
     */
    public function catalog(): ?array
    {
        $catalog = Cache::get(self::CatalogKey);

        return is_array($catalog) ? $catalog : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function process(string $processId): ?array
    {
        $process = Cache::get($this->processKey($processId));

        return is_array($process) ? $process : null;
    }

    /**
     * @param  array<string, mixed>  $catalog
     */
    public function putCatalog(array $catalog): void
    {
        Cache::put(self::CatalogKey, $catalog, $this->ttl());
    }

    /**
     * @param  array<string, mixed>  $process
     */
    public function putProcess(string $processId, array $process): void
    {
        Cache::put($this->processKey($processId), $process, $this->ttl());
    }

    public function warm(): void
    {
        $loadedProcesses = 0;

        try {
            $catalog = $this->client->processes();
            $this->putCatalog($catalog);

            foreach ($this->processIds($catalog) as $processId) {
                $this->putProcess($processId, $this->client->process($processId));
                $loadedProcesses++;
            }

            Log::info('OGC process cache warm-up completed.', [
                'base_url' => $this->baseUrl(),
                'process_count' => $loadedProcesses,
            ]);
        } catch (Throwable $exception) {
            Log::error('OGC process cache warm-up failed.', [
                'base_url' => $this->baseUrl(),
                'loaded_process_count' => $loadedProcesses,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    /**
     * @param  array<string, mixed>  $catalog
     * @return array<int, string>
     */
    public function processIds(array $catalog): array
    {
        $ids = [];

        foreach (($catalog['processes'] ?? []) as $process) {
            if (! is_array($process)) {
                continue;
            }

            $id = $process['id'] ?? null;

            if (! is_string($id) || $id === '') {
                continue;
            }

            $ids[] = $id;
        }

        return array_values(array_unique($ids));
    }

    public function processKey(string $processId): string
    {
        return "ogc-processes.process.{$processId}";
    }

    private function ttl(): int
    {
        return max(1, (int) config('services.ogc_processes.cache_ttl', 300));
    }

    private function baseUrl(): string
    {
        return (string) config('services.ogc_processes.base_url');
    }
}
```

- [ ] **Step 4: Run the service tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/OgcProcessCacheTest.php
```

Expected: PASS.

- [ ] **Step 5: Commit the service**

Run:

```bash
git add app/Services/Ogc/OgcProcessCache.php tests/Unit/Ogc/OgcProcessCacheTest.php
git commit -m "Add OGC process cache service"
```

Expected: commit succeeds with the service and its tests.

---

### Task 2: Add The Warm-Up Job

**Files:**
- Create: `tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php`
- Create: `app/Jobs/Ogc/WarmOgcProcessCacheJob.php`

- [ ] **Step 1: Write the failing job tests**

Create `tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php`:

```php
<?php

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

test('it warms the ogc process cache', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
        'https://voice.pi.ingv.it/geoinquire/processes/solwcad?f=json' => Http::response(ogcFixture('process-solwcad')),
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
        'https://voice.pi.ingv.it/geoinquire/processes/pybox?f=json' => Http::response(ogcFixture('process-pybox')),
    ]);

    (new WarmOgcProcessCacheJob())->handle(app(OgcProcessCache::class));

    $cache = app(OgcProcessCache::class);

    expect($cache->catalog()['processes'])->toHaveCount(3)
        ->and($cache->process('conduit')['id'])->toBe('conduit');
});

test('it prevents overlapping warm-up executions', function () {
    $middleware = (new WarmOgcProcessCacheJob())->middleware();

    expect($middleware)->toHaveCount(1)
        ->and($middleware[0])->toBeInstanceOf(WithoutOverlapping::class);
});

test('it retries with progressive backoff', function () {
    $job = new WarmOgcProcessCacheJob();

    expect($job->tries)->toBe(3)
        ->and($job->backoff())->toBe([30, 120, 300]);
});
```

- [ ] **Step 2: Run the job tests to verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php
```

Expected: FAIL because `App\Jobs\Ogc\WarmOgcProcessCacheJob` does not exist.

- [ ] **Step 3: Implement the warm-up job**

Create `app/Jobs/Ogc/WarmOgcProcessCacheJob.php`:

```php
<?php

namespace App\Jobs\Ogc;

use App\Services\Ogc\OgcProcessCache;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class WarmOgcProcessCacheJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 3;

    public function handle(OgcProcessCache $cache): void
    {
        $cache->warm();
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping(OgcProcessCache::WarmupLockKey))
                ->shared()
                ->expireAfter(300)
                ->dontRelease(),
        ];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120, 300];
    }
}
```

- [ ] **Step 4: Run the job tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php
```

Expected: PASS.

- [ ] **Step 5: Commit the job**

Run:

```bash
git add app/Jobs/Ogc/WarmOgcProcessCacheJob.php tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php
git commit -m "Add OGC process cache warm-up job"
```

Expected: commit succeeds with the job and tests.

---

### Task 3: Dispatch Warm-Up From Queue Runtime Boot

**Files:**
- Create: `tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php`
- Create: `app/Services/Ogc/OgcProcessCacheWarmupDispatcher.php`
- Modify: `app/Providers/AppServiceProvider.php`

- [ ] **Step 1: Write the failing dispatcher tests**

Create `tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php`:

```php
<?php

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();
});

test('it dispatches warm-up for queue runtime commands once per window', function () {
    Bus::fake();

    $dispatcher = app(OgcProcessCacheWarmupDispatcher::class);

    expect($dispatcher->dispatchForCommand('queue:work'))->toBeTrue()
        ->and(Cache::has(OgcProcessCache::WarmupDispatchedKey))->toBeTrue()
        ->and($dispatcher->dispatchForCommand('queue:work'))->toBeFalse();

    Bus::assertDispatchedTimes(WarmOgcProcessCacheJob::class, 1);
});

test('it dispatches warm-up for horizon commands', function () {
    Bus::fake();

    expect(app(OgcProcessCacheWarmupDispatcher::class)->dispatchForCommand('horizon'))->toBeTrue();

    Bus::assertDispatched(WarmOgcProcessCacheJob::class);
});

test('it skips non queue runtime commands', function () {
    Bus::fake();

    $dispatcher = app(OgcProcessCacheWarmupDispatcher::class);

    expect($dispatcher->dispatchForCommand('migrate'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand('route:list'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand('config:cache'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand(null))->toBeFalse();

    Bus::assertNotDispatched(WarmOgcProcessCacheJob::class);
});

test('it skips automatic dispatch while tests are running', function () {
    Bus::fake();

    expect(app(OgcProcessCacheWarmupDispatcher::class)->dispatchIfAppropriate())->toBeFalse();

    Bus::assertNotDispatched(WarmOgcProcessCacheJob::class);
});
```

- [ ] **Step 2: Run the dispatcher tests to verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php
```

Expected: FAIL because `App\Services\Ogc\OgcProcessCacheWarmupDispatcher` does not exist.

- [ ] **Step 3: Implement the dispatcher**

Create `app/Services/Ogc/OgcProcessCacheWarmupDispatcher.php`:

```php
<?php

namespace App\Services\Ogc;

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class OgcProcessCacheWarmupDispatcher
{
    /**
     * @var array<int, string>
     */
    private const RuntimeCommands = [
        'queue:work',
        'queue:listen',
        'horizon',
        'horizon:listen',
        'horizon:work',
    ];

    private const DispatchFlagTtlSeconds = 300;

    public function dispatchIfAppropriate(): bool
    {
        if (app()->runningUnitTests()) {
            return false;
        }

        return $this->dispatchForCommand($this->currentCommand());
    }

    public function dispatchForCommand(?string $command): bool
    {
        if (! is_string($command) || ! in_array($command, self::RuntimeCommands, true)) {
            return false;
        }

        try {
            if (! Cache::add(OgcProcessCache::WarmupDispatchedKey, true, self::DispatchFlagTtlSeconds)) {
                return false;
            }

            WarmOgcProcessCacheJob::dispatch();

            return true;
        } catch (Throwable $exception) {
            Log::warning('Unable to dispatch OGC process cache warm-up.', [
                'command' => $command,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function currentCommand(): ?string
    {
        $command = $_SERVER['argv'][1] ?? null;

        return is_string($command) ? $command : null;
    }
}
```

- [ ] **Step 4: Run the dispatcher tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php
```

Expected: PASS.

- [ ] **Step 5: Wire the dispatcher into application boot**

Modify `app/Providers/AppServiceProvider.php` to inject and call the dispatcher:

```php
<?php

namespace App\Providers;

use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(OgcProcessCacheWarmupDispatcher $warmupDispatcher): void
    {
        $this->configureDefaults();
        $warmupDispatcher->dispatchIfAppropriate();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
```

- [ ] **Step 6: Run dispatcher tests after provider wiring**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php
```

Expected: PASS.

- [ ] **Step 7: Commit the dispatcher**

Run:

```bash
git add app/Services/Ogc/OgcProcessCacheWarmupDispatcher.php app/Providers/AppServiceProvider.php tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php
git commit -m "Dispatch OGC cache warm-up from queue boot"
```

Expected: commit succeeds with dispatcher, provider wiring, and tests.

---

### Task 4: Make Process Controllers Cache-Only

**Files:**
- Modify: `tests/Feature/Ogc/ProcessCatalogTest.php`
- Modify: `app/Http/Controllers/Ogc/ProcessController.php`

- [ ] **Step 1: Replace process catalog tests with cache-only expectations**

Replace `tests/Feature/Ogc/ProcessCatalogTest.php` with:

```php
<?php

use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

test('guests cannot access process catalog', function () {
    $this->get('/processes')->assertRedirect(route('login'));
});

test('authenticated users can view cached process catalog', function () {
    app(OgcProcessCache::class)->putCatalog(ogcFixture('processes'));

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->where('catalogStatus', 'ready')
            ->has('processes', 3));
});

test('authenticated users see catalog warming state when cache is missing', function () {
    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->where('catalogStatus', 'warming')
            ->has('processes', 0));
});

test('authenticated users can view cached process detail with normalized schema', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('process.id', 'conduit')
            ->has('formSchema.fields.melt_composition'));
});

test('authenticated users see process warming state when detail cache is missing', function () {
    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'warming')
            ->where('process', null)
            ->where('formSchema', null));
});

test('process detail exposes example payload for local environments', function () {
    app()->detectEnvironment(fn (): string => 'local');
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('formSchema.examplePayload.inputs.melt_composition.value.sio2', 0.7669)
            ->where('formSchema.examplePayload.outputs.gas.transmissionMode', 'value'));
});

test('process detail hides example payload outside local environments', function () {
    app()->detectEnvironment(fn (): string => 'production');
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('formSchema.examplePayload', null));
});
```

- [ ] **Step 2: Run catalog tests to verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessCatalogTest.php
```

Expected: FAIL because `ProcessController` still fetches remote data through `Cache::remember()` when cache entries are missing and does not pass status props.

- [ ] **Step 3: Update the controller to use cache-only reads**

Replace `app/Http/Controllers/Ogc/ProcessController.php` with:

```php
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
```

- [ ] **Step 4: Run catalog tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessCatalogTest.php
```

Expected: PASS.

- [ ] **Step 5: Commit cache-only controller behavior**

Run:

```bash
git add app/Http/Controllers/Ogc/ProcessController.php tests/Feature/Ogc/ProcessCatalogTest.php
git commit -m "Make process pages read from warmed cache"
```

Expected: commit succeeds with controller and feature tests.

---

### Task 5: Add Warming States To React Pages

**Files:**
- Modify: `resources/js/types/ogc.ts`
- Modify: `resources/js/pages/processes/index.tsx`
- Modify: `resources/js/pages/processes/show.tsx`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Add source-level UI expectations**

Append this test to `tests/Unit/ProcessUiLayoutTest.php`:

```php
test('process pages expose cache warming states', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/processes/index.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/processes/show.tsx');

    expect($indexSource)
        ->toContain('catalogStatus')
        ->toContain('Service catalog is being prepared')
        ->toContain('Spinner')
        ->and($showSource)
        ->toContain('processStatus')
        ->toContain('Process description is being prepared')
        ->toContain('formSchema === null');
});
```

- [ ] **Step 2: Run UI layout tests to verify failure**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="process pages expose cache warming states"
```

Expected: FAIL because the React pages do not contain warming state handling.

- [ ] **Step 3: Add the cache status type**

In `resources/js/types/ogc.ts`, add this type before `OgcProcessSummary`:

```ts
export type OgcCacheStatus = 'ready' | 'warming';
```

- [ ] **Step 4: Update the process index page**

Replace `resources/js/pages/processes/index.tsx` with:

```tsx
import { Head, Link } from '@inertiajs/react';
import { ArrowRightIcon, CpuIcon, PlayCircleIcon } from 'lucide-react';

import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { index, show } from '@/routes/processes';
import type { OgcCacheStatus, OgcProcessSummary } from '@/types';

export default function ProcessIndex({
    catalogStatus = 'ready',
    processes,
}: {
    catalogStatus?: OgcCacheStatus;
    processes: OgcProcessSummary[];
}) {
    const isWarming = catalogStatus === 'warming';

    return (
        <>
            <Head title="Processes" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">Processes</h1>
                        <p className="text-sm text-muted-foreground">
                            Available OGC API processes from Geo-INQUIRE.
                        </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                        {processes.length}{' '}
                        {processes.length === 1 ? 'process' : 'processes'}
                    </Badge>
                </div>

                {isWarming ? (
                    <Alert>
                        <Spinner className="text-primary" />
                        <AlertTitle>
                            Service catalog is being prepared
                        </AlertTitle>
                        <AlertDescription>
                            The process list will appear when the background
                            warm-up finishes.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                        {processes.map((process) => {
                            const description =
                                process.description?.trim() ||
                                'No description provided.';

                            return (
                                <article
                                    key={process.id}
                                    className="group h-full"
                                >
                                    <Card className="h-full overflow-hidden transition-colors group-hover:border-primary/40 group-hover:bg-accent/20">
                                        <CardHeader className="gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                    <CpuIcon
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                                        <CardTitle className="truncate text-base leading-tight">
                                                            {process.title ??
                                                                process.id}
                                                        </CardTitle>
                                                        {process.version ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="shrink-0"
                                                            >
                                                                {`v${process.version}`}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <CardDescription className="truncate font-mono text-xs">
                                                        {process.id}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex flex-1 flex-col gap-5">
                                            <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                                                {description}
                                            </p>
                                            <div className="flex flex-col gap-4">
                                                <ProcessMetadataSection
                                                    label="Job controls"
                                                    values={
                                                        process.jobControlOptions
                                                    }
                                                    emptyLabel="Not advertised"
                                                />
                                                <ProcessMetadataSection
                                                    label="Output modes"
                                                    values={
                                                        process.outputTransmission
                                                    }
                                                    emptyLabel="Default response"
                                                />
                                            </div>
                                        </CardContent>
                                        <CardFooter className="mt-auto px-6 pt-0">
                                            <Button
                                                asChild
                                                className="w-full justify-between"
                                            >
                                                <Link href={show(process.id)}>
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <PlayCircleIcon data-icon="inline-start" />
                                                        <span className="truncate">
                                                            Open process
                                                        </span>
                                                    </span>
                                                    <ArrowRightIcon data-icon="inline-end" />
                                                </Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

function ProcessMetadataSection({
    emptyLabel,
    label,
    values,
}: {
    emptyLabel: string;
    label: string;
    values?: string[];
}) {
    const visibleValues = values?.filter(Boolean) ?? [];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium">
                <span>{label}</span>
                <span className="text-muted-foreground">
                    {visibleValues.length}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {visibleValues.length > 0 ? (
                    visibleValues.map((value) => (
                        <Badge key={value} variant="secondary">
                            {value}
                        </Badge>
                    ))
                ) : (
                    <Badge variant="outline">{emptyLabel}</Badge>
                )}
            </div>
        </div>
    );
}

ProcessIndex.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            href: index(),
        },
    ],
};
```

- [ ] **Step 5: Update the process detail page**

Replace `resources/js/pages/processes/show.tsx` with:

```tsx
import { Head } from '@inertiajs/react';

import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { index } from '@/routes/processes';
import type { OgcCacheStatus, OgcFormSchema } from '@/types';

export default function ProcessShow({
    formSchema,
    processStatus = 'ready',
}: {
    formSchema: OgcFormSchema | null;
    processStatus?: OgcCacheStatus;
}) {
    if (processStatus === 'warming' || formSchema === null) {
        return (
            <>
                <Head title="Process preparing" />

                <div className="flex min-w-0 flex-col gap-4 p-4">
                    <Alert>
                        <Spinner className="text-primary" />
                        <AlertTitle>
                            Process description is being prepared
                        </AlertTitle>
                        <AlertDescription>
                            The process form will appear when the background
                            warm-up finishes.
                        </AlertDescription>
                    </Alert>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={formSchema.title} />

            <div className="flex min-w-0 flex-col gap-4 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-2xl font-semibold">
                        {formSchema.title}
                    </h1>
                    <p className="text-sm break-words text-muted-foreground">
                        {formSchema.description}
                    </p>
                </div>

                <DynamicProcessForm schema={formSchema} />
            </div>
        </>
    );
}

ProcessShow.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            href: index(),
        },
    ],
};
```

- [ ] **Step 6: Run UI layout tests**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php
```

Expected: PASS.

- [ ] **Step 7: Run TypeScript check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 8: Commit the warming UI**

Run:

```bash
git add resources/js/types/ogc.ts resources/js/pages/processes/index.tsx resources/js/pages/processes/show.tsx tests/Unit/ProcessUiLayoutTest.php
git commit -m "Show warming states for process cache"
```

Expected: commit succeeds with React pages, type updates, and UI test.

---

### Task 6: Format And Verify The Full Change

**Files:**
- Modify only files changed by Tasks 1-5 if formatters adjust them.

- [ ] **Step 1: Run Pint for PHP formatting**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint completes successfully. If it changes files, review the diff.

- [ ] **Step 2: Run the focused PHP test suite**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/OgcProcessCacheTest.php tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php tests/Feature/Ogc/ProcessCatalogTest.php tests/Unit/ProcessUiLayoutTest.php
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 4: Run frontend lint check**

Run:

```bash
bun run lint:check
```

Expected: PASS.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --stat
git diff -- app/Services/Ogc app/Jobs/Ogc app/Providers/AppServiceProvider.php app/Http/Controllers/Ogc/ProcessController.php resources/js/types/ogc.ts resources/js/pages/processes/index.tsx resources/js/pages/processes/show.tsx tests/Unit/Ogc tests/Feature/Ogc tests/Unit/ProcessUiLayoutTest.php
```

Expected: diff contains only OGC cache warm-up service/job/dispatcher, process controller cache-only behavior, warming UI, and tests.

- [ ] **Step 6: Commit verification formatting changes**

If Pint or frontend tooling changed files after the previous commits, run:

```bash
git add app/Services/Ogc app/Jobs/Ogc app/Providers/AppServiceProvider.php app/Http/Controllers/Ogc/ProcessController.php resources/js/types/ogc.ts resources/js/pages/processes/index.tsx resources/js/pages/processes/show.tsx tests/Unit/Ogc tests/Feature/Ogc tests/Unit/ProcessUiLayoutTest.php
git commit -m "Format OGC cache warm-up changes"
```

Expected: commit succeeds only if there are formatter changes. If `git status --short` is clean, skip this commit.

- [ ] **Step 7: Report verification evidence**

Collect these exact results for the final implementation response:

```text
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Unit/Ogc/OgcProcessCacheTest.php tests/Feature/Ogc/WarmOgcProcessCacheJobTest.php tests/Feature/Ogc/OgcProcessCacheWarmupDispatcherTest.php tests/Feature/Ogc/ProcessCatalogTest.php tests/Unit/ProcessUiLayoutTest.php
bun run types:check
bun run lint:check
```

Expected: every command passes, or any failure is reported with the failing command and error summary.
