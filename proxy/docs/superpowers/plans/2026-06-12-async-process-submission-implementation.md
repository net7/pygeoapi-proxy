# Async Process Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make process start requests redirect immediately to the local job detail page while the remote OGC submission runs in a queued job.

**Architecture:** Split current `StartProcessExecution` behavior into local record creation and remote submission. The controller reads process metadata from `OgcProcessCache`, creates a `ProcessExecution` in `submitting`, dispatches `SubmitProcessExecutionJob` with the original payload, flashes a confirmation toast, and redirects. The queued job calls pygeoapi, updates the local execution, and reuses the existing polling/result storage pipeline.

**Tech Stack:** Laravel 13 queues, Inertia Laravel 3 flash data, Pest 4, Laravel HTTP/Bus fakes, existing OGC action/model/service layer.

---

## File Map

- Create `app/Actions/Ogc/CreateProcessExecution.php`: creates the local execution and stores the redacted UI/history payload.
- Create `app/Actions/Ogc/SubmitProcessExecution.php`: submits original payload to pygeoapi and updates the existing execution.
- Create `app/Jobs/Ogc/SubmitProcessExecutionJob.php`: queue wrapper with overlap protection and idempotent exits.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionController.php`: remove synchronous remote submission, use cache-only process metadata, dispatch the job, flash toast.
- Delete `app/Actions/Ogc/StartProcessExecution.php`: replaced by the two focused actions.
- Modify `tests/Feature/Ogc/ProcessExecutionTest.php`: cover immediate redirect, cache-only POST, local creation, remote submission outcomes, and job idempotency.
- Keep `tests/Feature/Ogc/PollProcessExecutionJobTest.php`: run as regression coverage for polling handoff.
- Modify `docs/superpowers/specs/2026-06-12-async-process-submission-design.md`: already clarified original payload handling for the queued job.

---

### Task 1: Add Failing Feature Tests For Immediate Redirect

**Files:**
- Modify: `tests/Feature/Ogc/ProcessExecutionTest.php`

- [ ] **Step 1: Replace imports at the top of the test file**

```php
use App\Actions\Ogc\CreateProcessExecution;
use App\Actions\Ogc\SubmitProcessExecution;
use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
```

- [ ] **Step 2: Add POST tests before action-level tests**

```php
test('starting a process creates a local execution and redirects without remote submission', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    app(OgcProcessCache::class)->putProcess('conduit', $process);

    $payload = [
        'mode' => 'sync',
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];

    $response = $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), $payload);

    $execution = ProcessExecution::query()->sole();

    $response
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Process queued')
        ->assertInertiaFlash('toast.type', 'success');

    expect($execution->user->is($user))->toBeTrue()
        ->and($execution->process_id)->toBe('conduit')
        ->and($execution->process_title)->toBe($process['title'])
        ->and($execution->execution_mode)->toBe(ExecutionMode::Sync)
        ->and($execution->status)->toBe(ExecutionStatus::Submitting)
        ->and($execution->progress)->toBe(0)
        ->and($execution->request_payload['inputs'])->toBe($payload['inputs'])
        ->and($execution->requested_outputs)->toBe($payload['outputs'])
        ->and($execution->process_outputs)->toBe($process['outputs']);

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->processExecutionId === $execution->id
        && $job->payload['inputs'] === $payload['inputs']
        && $job->payload['outputs'] === $payload['outputs']);

    Http::assertNothingSent();
});

test('starting a process does not fall back to pygeoapi when process cache is missing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $response = $this->actingAs(User::factory()->create())->post(route('processes.jobs.store', 'conduit'), [
        'mode' => 'async',
        'inputs' => ['lat' => 14.47],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    $response->assertStatus(409);

    expect(ProcessExecution::query()->count())->toBe(0);

    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});
```

- [ ] **Step 3: Run tests to confirm the new behavior is failing**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php
```

Expected: FAIL because `SubmitProcessExecutionJob`, `CreateProcessExecution`, and `SubmitProcessExecution` do not exist and the controller still calls pygeoapi synchronously.

---

### Task 2: Implement Local Creation Action

**Files:**
- Create: `app/Actions/Ogc/CreateProcessExecution.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionTest.php`

- [ ] **Step 1: Add the local creation test**

```php
test('it creates a submitting local execution with redacted stored payload', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $largeInlineValue = str_repeat('A', 2049);
    $payload = [
        'inputs' => ['input_data' => ['value' => $largeInlineValue]],
        'outputs' => ['dem' => ['transmissionMode' => 'value']],
    ];

    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: $payload,
        mode: ExecutionMode::Async,
    );

    expect($execution->status)->toBe(ExecutionStatus::Submitting)
        ->and($execution->progress)->toBe(0)
        ->and($execution->remote_job_id)->toBeNull()
        ->and($execution->submitted_at)->not->toBeNull()
        ->and($execution->request_payload['inputs']['input_data']['value'])->toBe('[redacted inline value]')
        ->and($execution->request_payload['inputs']['input_data']['sizeBytes'])->toBe(2049)
        ->and($execution->requested_outputs)->toBe($payload['outputs'])
        ->and($execution->process_outputs)->toBe($process['outputs']);
});
```

- [ ] **Step 2: Create `CreateProcessExecution`**

```php
<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;

class CreateProcessExecution
{
    /**
     * @param  array<string, mixed>  $process
     * @param  array<string, mixed>  $payload
     */
    public function handle(User $user, array $process, array $payload, ExecutionMode $mode): ProcessExecution
    {
        return ProcessExecution::create([
            'user_id' => $user->id,
            'process_id' => (string) $process['id'],
            'process_title' => $process['title'] ?? $process['id'],
            'process_version' => $process['version'] ?? null,
            'execution_mode' => $mode,
            'status' => ExecutionStatus::Submitting,
            'progress' => 0,
            'request_payload' => $this->redactLargeInlineValues($payload),
            'requested_outputs' => $payload['outputs'] ?? null,
            'process_outputs' => $process['outputs'] ?? null,
            'submitted_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function redactLargeInlineValues(array $payload): array
    {
        $inputs = collect($payload['inputs'] ?? [])
            ->map(function (mixed $input): mixed {
                if (! is_array($input) || ! isset($input['value']) || ! is_string($input['value']) || strlen($input['value']) <= 2048) {
                    return $input;
                }

                return [
                    ...$input,
                    'value' => '[redacted inline value]',
                    'sizeBytes' => strlen($input['value']),
                ];
            })
            ->all();

        return [
            ...$payload,
            'inputs' => $inputs,
        ];
    }
}
```

- [ ] **Step 3: Run the local creation test**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter="creates a submitting local execution"
```

Expected: PASS after the action exists.

---

### Task 3: Implement Remote Submission Action

**Files:**
- Create: `app/Actions/Ogc/SubmitProcessExecution.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionTest.php`
- Delete later: `app/Actions/Ogc/StartProcessExecution.php`

- [ ] **Step 1: Replace old `StartProcessExecution` tests with `SubmitProcessExecution` tests**

Use these test names and assertions:

```php
test('it submits a synchronous execution with the original payload and stores preview result', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    $payload = [
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];
    $execution = app(CreateProcessExecution::class)->handle($user, $process, $payload, ExecutionMode::Sync);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(ogcFixture('chart-result')),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->results)->toHaveCount(1)
        ->and($execution->results->first()->preview['kind'])->toBe('chart');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution'
        && $request['inputs'] === $payload['inputs']
        && $request['outputs'] === $payload['outputs']);
});

test('it submits an asynchronous execution and dispatches polling', function () {
    Bus::fake();

    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $payload = ['inputs' => ['lat' => 14.47], 'outputs' => ['input_data' => ['transmissionMode' => 'value']]];
    $execution = app(CreateProcessExecution::class)->handle($user, $process, $payload, ExecutionMode::Async);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/pybox/execution' => Http::response([], 201, [
            'Location' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123',
        ]),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->remote_job_id)->toBe('job-123');

    Bus::assertDispatched(PollProcessExecutionJob::class);
});

test('it stores submission failures on the existing local execution', function () {
    $user = User::factory()->create();
    $payload = ['inputs' => ['bad' => true]];
    $execution = app(CreateProcessExecution::class)->handle($user, ogcFixture('process-conduit'), $payload, ExecutionMode::Sync);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'Bad input',
        ], 500),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::SubmissionFailed)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->message)->toContain('Bad input');
});
```

- [ ] **Step 2: Create `SubmitProcessExecution`**

```php
<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

class SubmitProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(ProcessExecution $execution, array $payload): ProcessExecution
    {
        if ($execution->status->isTerminal() || filled($execution->remote_job_id)) {
            return $execution->refresh();
        }

        try {
            $response = $this->client->execute($execution->process_id, $payload, $execution->execution_mode->preferHeader());
        } catch (RequestException $exception) {
            $execution->update([
                'status' => ExecutionStatus::SubmissionFailed,
                'message' => $exception->response->json('description') ?? $exception->getMessage(),
                'failed_at' => now(),
            ]);

            return $execution->refresh();
        } catch (\Throwable $exception) {
            $execution->update([
                'status' => ExecutionStatus::SubmissionFailed,
                'message' => $exception->getMessage(),
                'failed_at' => now(),
            ]);

            return $execution->refresh();
        }

        if ($response->status() === 201) {
            $execution->update([
                'status' => ExecutionStatus::Accepted,
                'progress' => 5,
                'remote_job_id' => $this->jobIdFromLocation($response->header('Location')),
            ]);

            PollProcessExecutionJob::dispatch($execution->id)->delay(now()->addSeconds(5));

            return $execution->refresh();
        }

        $execution->update([
            'status' => ExecutionStatus::Successful,
            'progress' => 100,
            'completed_at' => now(),
        ]);

        $this->storeProcessResult->fromResponse($execution->refresh(), $response);

        return $execution->refresh()->load('results');
    }

    private function jobIdFromLocation(?string $location): ?string
    {
        if (! filled($location)) {
            return null;
        }

        return Str::of($location)->afterLast('/')->before('?')->toString();
    }
}
```

- [ ] **Step 3: Run submission tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter="submits"
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter="submission failures"
```

Expected: PASS after the action exists.

---

### Task 4: Add Submission Job

**Files:**
- Create: `app/Jobs/Ogc/SubmitProcessExecutionJob.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionTest.php`

- [ ] **Step 1: Add job idempotency tests**

```php
test('submission job ignores missing terminal and already submitted executions', function () {
    Http::fake();

    (new SubmitProcessExecutionJob(999999, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    $terminal = ProcessExecution::factory()->create([
        'status' => ExecutionStatus::Successful,
        'remote_job_id' => null,
    ]);

    (new SubmitProcessExecutionJob($terminal->id, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    $alreadySubmitted = ProcessExecution::factory()->create([
        'status' => ExecutionStatus::Accepted,
        'remote_job_id' => 'job-123',
    ]);

    (new SubmitProcessExecutionJob($alreadySubmitted->id, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    Http::assertNothingSent();
});
```

- [ ] **Step 2: Create `SubmitProcessExecutionJob`**

```php
<?php

namespace App\Jobs\Ogc;

use App\Actions\Ogc\SubmitProcessExecution;
use App\Models\ProcessExecution;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SubmitProcessExecutionJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 3;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public int $processExecutionId,
        public array $payload,
    ) {}

    public function handle(SubmitProcessExecution $submitProcessExecution): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if ($execution === null || $execution->status->isTerminal() || filled($execution->remote_job_id)) {
            return;
        }

        $submitProcessExecution->handle($execution, $this->payload);
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("process-execution-submit-{$this->processExecutionId}"))->expireAfter(180)];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [5, 10, 30];
    }
}
```

- [ ] **Step 3: Run job test**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter="submission job"
```

Expected: PASS.

---

### Task 5: Update Controller To Dispatch And Redirect Immediately

**Files:**
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- Delete: `app/Actions/Ogc/StartProcessExecution.php`

- [ ] **Step 1: Replace controller dependencies and `store()` body**

Use this structure:

```php
use App\Actions\Ogc\CreateProcessExecution;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Services\Ogc\OgcProcessCache;
use Inertia\Inertia;
```

```php
public function store(
    StoreProcessExecutionRequest $request,
    string $process,
    OgcProcessCache $cache,
    CreateProcessExecution $createProcessExecution,
): RedirectResponse {
    $user = $request->user();
    assert($user instanceof User);

    $processDescription = $cache->process($process);

    abort_if($processDescription === null, 409, 'Process description is still warming up.');

    $payload = $request->executionPayload();
    $mode = $request->executionMode();

    $execution = $createProcessExecution->handle(
        user: $user,
        process: $processDescription,
        payload: $payload,
        mode: $mode,
    );

    SubmitProcessExecutionJob::dispatch($execution->id, $payload);

    Inertia::flash('toast', [
        'type' => 'success',
        'title' => __('Process queued'),
        'message' => __('Process queued.'),
        'description' => __(':process was queued as local job #:job using :mode mode.', [
            'process' => $execution->process_title ?? $execution->process_id,
            'job' => $execution->id,
            'mode' => $mode->value,
        ]),
    ]);

    return redirect()->route('jobs.show', $execution);
}
```

- [ ] **Step 2: Delete the replaced action file**

Delete `app/Actions/Ogc/StartProcessExecution.php` after `rg StartProcessExecution app tests` returns no references.

- [ ] **Step 3: Run immediate redirect tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter="starting a process"
```

Expected: PASS.

---

### Task 6: Full Verification And Formatting

**Files:**
- All modified PHP files.

- [ ] **Step 1: Run Pint**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: all modified PHP files formatted.

- [ ] **Step 2: Run focused OGC tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php
```

Expected: PASS.

- [ ] **Step 3: Check references and working tree**

Run:

```bash
rg -n "StartProcessExecution" app tests
git status --short
```

Expected: no `StartProcessExecution` references; working tree contains only intended files.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add app/Actions/Ogc app/Http/Controllers/Ogc/ProcessExecutionController.php app/Jobs/Ogc tests/Feature/Ogc/ProcessExecutionTest.php docs/superpowers/specs/2026-06-12-async-process-submission-design.md docs/superpowers/plans/2026-06-12-async-process-submission-implementation.md
git commit -m "Queue OGC process submission"
```

Expected: commit succeeds after tests pass.
