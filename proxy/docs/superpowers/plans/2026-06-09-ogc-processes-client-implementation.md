# OGC Processes Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated Laravel/Inertia client for OGC API - Processes with local execution history, async job polling, and result previews/downloads.

**Architecture:** Use a focused Laravel service client for the pygeoapi SaaS, local Eloquent models for execution state, action classes for orchestration, queued jobs for polling, and Inertia React/shadcn pages for the UI. Keep the remote catalog as the source of truth and cache it briefly; persist all user-launched executions locally.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 3, React 19, Wayfinder, Tailwind CSS 4, shadcn/ui, Horizon queues, Laravel notifications.

---

## File Map

### Backend

- Create `app/Enums/Ogc/ExecutionMode.php`: local execution mode enum.
- Create `app/Enums/Ogc/ExecutionStatus.php`: local execution status enum.
- Create `app/Enums/Ogc/ResultCacheStatus.php`: result cache status enum.
- Create `app/Services/Ogc/OgcProcessesClient.php`: HTTP wrapper around the SaaS.
- Create `app/Services/Ogc/ProcessSchemaNormalizer.php`: transforms OGC process descriptions into UI metadata.
- Create `app/Actions/Ogc/StartProcessExecution.php`: validates and submits execution requests.
- Create `app/Actions/Ogc/PollProcessExecution.php`: updates local execution state from remote job status.
- Create `app/Actions/Ogc/StoreProcessResult.php`: stores result metadata and supported previews.
- Create `app/Jobs/Ogc/PollProcessExecutionJob.php`: queued polling job.
- Create `app/Notifications/Ogc/ProcessExecutionCompleted.php`: database notification for successful/failed completion.
- Create `app/Models/ProcessExecution.php`: Eloquent model for user execution history.
- Create `app/Models/ProcessExecutionResult.php`: Eloquent model for execution outputs.
- Modify `app/Models/User.php`: add `processExecutions()` relationship.
- Create migrations for `process_executions`, `process_execution_results`, and database notifications.
- Create `database/factories/ProcessExecutionFactory.php`.
- Create `database/factories/ProcessExecutionResultFactory.php`.
- Create `app/Http/Controllers/Ogc/ProcessController.php`: list and detail remote processes.
- Create `app/Http/Controllers/Ogc/ProcessExecutionController.php`: submit and show local executions.
- Create `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`: download/cache result content.
- Create `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php`: backend request validation.
- Create `app/Policies/ProcessExecutionPolicy.php`: ownership checks.
- Modify `routes/web.php`: add authenticated OGC routes.
- Modify `config/services.php`: add `ogc_processes` config.

### Frontend

- Create `resources/js/types/ogc.ts`: shared OGC UI metadata types.
- Modify `resources/js/types/index.ts`: export OGC types.
- Create `resources/js/pages/processes/index.tsx`: process list page.
- Create `resources/js/pages/processes/show.tsx`: process detail and execution form page.
- Create `resources/js/pages/process-executions/index.tsx`: user history page.
- Create `resources/js/pages/process-executions/show.tsx`: execution detail page.
- Create `resources/js/components/ogc/dynamic-process-form.tsx`: form orchestrator.
- Create `resources/js/components/ogc/schema-field-renderer.tsx`: recursive field renderer.
- Create `resources/js/components/ogc/one-of-field.tsx`: `oneOf` selector.
- Create `resources/js/components/ogc/array-object-field.tsx`: repeatable object rows.
- Create `resources/js/components/ogc/array-table-field.tsx`: array-of-arrays editor.
- Create `resources/js/components/ogc/output-selector.tsx`: output transmission options.
- Create `resources/js/components/ogc/result-preview.tsx`: text, JSON, CSV, chart metadata, binary metadata previews.
- Modify `resources/js/components/app-sidebar.tsx`: add navigation entries.
- Regenerate Wayfinder files after route changes.

### Tests And Fixtures

- Create `tests/Fixtures/Ogc/landing-page.json`.
- Create `tests/Fixtures/Ogc/processes.json`.
- Create `tests/Fixtures/Ogc/process-solwcad.json`.
- Create `tests/Fixtures/Ogc/process-conduit.json`.
- Create `tests/Fixtures/Ogc/process-pybox.json`.
- Create `tests/Fixtures/Ogc/job-successful.json`.
- Create `tests/Fixtures/Ogc/job-failed.json`.
- Create `tests/Fixtures/Ogc/chart-result.json`.
- Create `tests/Unit/Ogc/OgcProcessesClientTest.php`.
- Create `tests/Unit/Ogc/ProcessSchemaNormalizerTest.php`.
- Create `tests/Feature/Ogc/ProcessCatalogTest.php`.
- Create `tests/Feature/Ogc/ProcessExecutionTest.php`.
- Create `tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php`.
- Create `tests/Feature/Ogc/ProcessExecutionResultTest.php`.
- Create `tests/Feature/Ogc/PollProcessExecutionJobTest.php`.

---

## Task 1: Backend Configuration, Enums, Fixtures, And HTTP Client

**Files:**
- Modify: `config/services.php`
- Create: `app/Enums/Ogc/ExecutionMode.php`
- Create: `app/Enums/Ogc/ExecutionStatus.php`
- Create: `app/Enums/Ogc/ResultCacheStatus.php`
- Create: `app/Services/Ogc/OgcProcessesClient.php`
- Create: `tests/Fixtures/Ogc/landing-page.json`
- Create: `tests/Fixtures/Ogc/processes.json`
- Create: `tests/Fixtures/Ogc/process-solwcad.json`
- Create: `tests/Fixtures/Ogc/process-conduit.json`
- Create: `tests/Fixtures/Ogc/process-pybox.json`
- Test: `tests/Unit/Ogc/OgcProcessesClientTest.php`

- [ ] **Step 1: Create the unit test**

Create `tests/Unit/Ogc/OgcProcessesClientTest.php`:

```php
<?php

use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

function ogcFixture(string $name): array
{
    return json_decode(
        file_get_contents(base_path("tests/Fixtures/Ogc/{$name}.json")),
        true,
        flags: JSON_THROW_ON_ERROR,
    );
}

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.timeout' => 12,
        'services.ogc_processes.connect_timeout' => 4,
    ]);
});

test('it fetches the landing page with json format', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/?f=json' => Http::response(ogcFixture('landing-page')),
    ]);

    $data = app(OgcProcessesClient::class)->landingPage();

    expect($data['title'])->toBe('Geo-INQUIRE Saas WP5 (based on pygeoapi)');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/?f=json'
        && $request->method() === 'GET');
});

test('it fetches the process list', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
    ]);

    $data = app(OgcProcessesClient::class)->processes();

    expect($data['processes'])
        ->toHaveCount(3)
        ->and($data['processes'][0]['id'])->toBe('solwcad');
});

test('it fetches a process description', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $data = app(OgcProcessesClient::class)->process('conduit');

    expect($data['id'])->toBe('conduit')
        ->and($data['inputs'])->toHaveKey('melt_composition');
});

test('it submits sync execution with prefer header', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(['chartType' => 'line'], 200),
    ]);

    $response = app(OgcProcessesClient::class)->execute('conduit', [
        'inputs' => ['lat' => 1],
        'outputs' => ['gas'],
    ], 'respond-sync');

    expect($response->status())->toBe(200)
        ->and($response->json('chartType'))->toBe('line');

    Http::assertSent(fn (Request $request): bool => $request->hasHeader('Prefer', 'respond-sync')
        && $request->hasHeader('Content-Type', 'application/json')
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution');
});

test('it fetches a remote job and results', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(['jobID' => 'job-123', 'status' => 'successful']),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response(['chartType' => 'line']),
    ]);

    $client = app(OgcProcessesClient::class);

    expect($client->job('job-123')['status'])->toBe('successful')
        ->and($client->jobResults('job-123')->json('chartType'))->toBe('line');
});
```

- [ ] **Step 2: Add compact SaaS fixtures**

Create `tests/Fixtures/Ogc/landing-page.json`:

```json
{
  "title": "Geo-INQUIRE Saas WP5 (based on pygeoapi)",
  "description": "pygeoapi fornisce API a dati geospaziali - In Geo-INQUIRE sono implementati servizi di processing",
  "links": [
    {
      "rel": "http://www.opengis.net/def/rel/ogc/1.0/processes",
      "type": "application/json",
      "title": "Processes",
      "href": "https://voice.pi.ingv.it/geoinquire/processes"
    },
    {
      "rel": "http://www.opengis.net/def/rel/ogc/1.0/job-list",
      "type": "application/json",
      "title": "Jobs",
      "href": "https://voice.pi.ingv.it/geoinquire/jobs"
    }
  ]
}
```

Create `tests/Fixtures/Ogc/processes.json`:

```json
{
  "processes": [
    {
      "id": "solwcad",
      "version": "1.0.0",
      "title": "SOLWCAD",
      "description": "Fortran code to compute the saturation surface of H2O-CO2 fluids in silicate melts of arbitrary composition.",
      "jobControlOptions": ["async-execute", "sync-execute"],
      "outputTransmission": ["value", "reference"]
    },
    {
      "id": "conduit",
      "version": "2.2.0",
      "title": "CONDUIT",
      "description": "CONDUIT4 is a Fortran code for computing magma flow in volcanic conduits.",
      "jobControlOptions": ["async-execute", "sync-execute"],
      "outputTransmission": ["value", "reference"]
    },
    {
      "id": "pybox",
      "version": "1.0.0",
      "title": "PYBOX",
      "description": "Python code to simulate pyroclastic density currents.",
      "jobControlOptions": ["async-execute"],
      "outputTransmission": ["value", "reference"]
    }
  ],
  "links": []
}
```

Create `tests/Fixtures/Ogc/process-conduit.json`:

```json
{
  "$defs": {
    "chart": {
      "type": "object",
      "required": ["chartType", "domain", "series"],
      "properties": {
        "chartType": { "type": "string" },
        "domain": { "type": "object" },
        "series": { "type": "array" }
      }
    }
  },
  "id": "conduit",
  "version": "2.2.0",
  "title": "CONDUIT",
  "description": "CONDUIT4 process",
  "jobControlOptions": ["async-execute", "sync-execute"],
  "outputTransmission": ["value", "reference"],
  "inputs": {
    "melt_composition": {
      "title": "Melt composition",
      "description": "Melt oxides",
      "schema": {
        "type": "object",
        "required": ["sio2", "tio2"],
        "properties": {
          "sio2": { "type": "number", "title": "SiO2", "exclusiveMinimum": 0, "exclusiveMaximum": 1 },
          "tio2": { "type": "number", "title": "TiO2", "exclusiveMinimum": 0, "exclusiveMaximum": 1 }
        }
      },
      "minOccurs": 1,
      "maxOccurs": 1
    },
    "geometry": {
      "title": "Geometry",
      "description": "Geometry of the conduit",
      "schema": {
        "type": "object",
        "required": ["g", "l"],
        "properties": {
          "g": { "type": "string", "title": "Geometry", "enum": ["conduit", "fissure"] },
          "l": { "type": "number", "title": "Conduit length [m]", "exclusiveMinimum": 0 }
        }
      },
      "minOccurs": 1,
      "maxOccurs": 1
    },
    "searching_mode": {
      "title": "Searching mode",
      "description": "Searching for mass flow rate or diameter",
      "schema": {
        "type": "object",
        "oneOf": [
          {
            "required": ["d"],
            "additionalProperties": false,
            "properties": {
              "d": { "type": "number", "title": "Conduit diameter [m]", "exclusiveMinimum": 0 }
            }
          },
          {
            "required": ["f"],
            "additionalProperties": false,
            "properties": {
              "f": { "type": "number", "title": "Mass flow rate [kg/s]", "exclusiveMinimum": 0 }
            }
          }
        ]
      },
      "minOccurs": 1,
      "maxOccurs": 1
    }
  },
  "outputs": {
    "gas": {
      "title": "Plot gas volume fraction",
      "description": "Profile of gas volume fraction.",
      "schema": { "$ref": "#/$defs/chart", "contentMediaType": "application/json" }
    },
    "outfile": {
      "title": "Table of output variables",
      "description": "CSV output",
      "schema": { "type": "string", "contentMediaType": "text/csv" }
    }
  }
}
```

Create `tests/Fixtures/Ogc/process-solwcad.json`:

```json
{
  "id": "solwcad",
  "version": "1.0.0",
  "title": "SOLWCAD",
  "description": "SOLWCAD process",
  "jobControlOptions": ["async-execute", "sync-execute"],
  "outputTransmission": ["value", "reference"],
  "inputs": {
    "swinput.data": {
      "title": "Desired computation",
      "description": "Specifics for the desired computation.",
      "schema": {
        "type": "object",
        "oneOf": [
          {
            "required": ["ndat1", "ndat2", "kl"],
            "additionalProperties": false,
            "properties": {
              "ndat1": { "type": "integer", "description": "Start item" },
              "ndat2": { "type": "integer", "description": "End item" },
              "kl": { "type": "integer", "enum": [0] }
            }
          },
          {
            "required": ["ndat1", "kl", "iopen"],
            "properties": {
              "ndat1": { "type": "integer", "description": "Start item" },
              "kl": { "type": "integer", "enum": [1] },
              "iopen": { "type": "integer", "enum": [0, 1] }
            }
          }
        ]
      },
      "minOccurs": 1,
      "maxOccurs": 1
    },
    "sw.data": {
      "title": "User data",
      "description": "Pressure, temperature, and composition rows.",
      "schema": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "array",
          "minItems": 14,
          "maxItems": 14,
          "items": { "type": "string" }
        }
      },
      "minOccurs": 1,
      "maxOccurs": 1
    }
  },
  "outputs": {
    "solwcad_out": {
      "title": "Output result",
      "description": "Array output",
      "schema": { "type": "array", "contentMediaType": "application/json" }
    }
  }
}
```

Create `tests/Fixtures/Ogc/process-pybox.json`:

```json
{
  "$defs": {
    "chart": {
      "type": "object",
      "required": ["chartType", "domain", "series"],
      "properties": {
        "chartType": { "type": "string" },
        "domain": { "type": "object" },
        "series": { "type": "array" }
      }
    }
  },
  "id": "pybox",
  "version": "1.0.0",
  "title": "PYBOX",
  "description": "PYBOX process",
  "jobControlOptions": ["async-execute"],
  "outputTransmission": ["value", "reference"],
  "inputs": {
    "lat": {
      "title": "Latitude",
      "description": "Geographic latitude",
      "schema": { "type": "number", "minimum": -90, "maximum": 90 },
      "minOccurs": 1,
      "maxOccurs": 1
    },
    "multiple_values": {
      "title": "Multiple particle classes",
      "description": "Particle classes",
      "schema": {
        "type": "array",
        "minItems": 1,
        "maxItems": 21,
        "items": {
          "type": "object",
          "required": ["eps0", "rhos", "ds"],
          "additionalProperties": false,
          "properties": {
            "eps0": { "type": "number", "minimum": 0.001, "maximum": 0.1 },
            "rhos": { "type": "number", "minimum": 500, "maximum": 3500 },
            "ds": { "type": "number", "minimum": 0.00001, "maximum": 0.005 }
          }
        }
      },
      "minOccurs": 1,
      "maxOccurs": 1
    }
  },
  "outputs": {
    "input_data": {
      "title": "Input parameters",
      "description": "Log of all input parameters used",
      "schema": { "type": "string", "contentMediaType": "text/plain" }
    },
    "invasion_map": {
      "title": "Invasion Map",
      "description": "2D GeoTIFF",
      "schema": { "type": "string", "contentEncoding": "binary", "contentMediaType": "application/tiff; application=geotiff" }
    },
    "spatial_evolution": {
      "title": "Spatial evolution",
      "description": "Chart result",
      "schema": { "$ref": "#/$defs/chart", "contentMediaType": "application/json" }
    }
  }
}
```

- [ ] **Step 3: Run the test and confirm it fails**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/OgcProcessesClientTest.php
```

Expected: failure because `App\Services\Ogc\OgcProcessesClient` does not exist.

- [ ] **Step 4: Add config and enums**

Append this entry before the closing array in `config/services.php`:

```php
    'ogc_processes' => [
        'base_url' => env('OGC_PROCESSES_BASE_URL', 'https://voice.pi.ingv.it/geoinquire/'),
        'timeout' => (int) env('OGC_PROCESSES_TIMEOUT', 30),
        'connect_timeout' => (int) env('OGC_PROCESSES_CONNECT_TIMEOUT', 5),
        'cache_ttl' => (int) env('OGC_PROCESSES_CACHE_TTL', 300),
        'binary_cache_ttl_days' => (int) env('OGC_PROCESSES_BINARY_CACHE_TTL_DAYS', 30),
    ],
```

Create `app/Enums/Ogc/ExecutionMode.php`:

```php
<?php

namespace App\Enums\Ogc;

enum ExecutionMode: string
{
    case Sync = 'sync';
    case Async = 'async';

    public function preferHeader(): string
    {
        return match ($this) {
            self::Sync => 'respond-sync',
            self::Async => 'respond-async',
        };
    }
}
```

Create `app/Enums/Ogc/ExecutionStatus.php`:

```php
<?php

namespace App\Enums\Ogc;

enum ExecutionStatus: string
{
    case Submitting = 'submitting';
    case Accepted = 'accepted';
    case Running = 'running';
    case Successful = 'successful';
    case Failed = 'failed';
    case SubmissionFailed = 'submission_failed';
    case RemoteMissing = 'remote_missing';

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Successful,
            self::Failed,
            self::SubmissionFailed,
            self::RemoteMissing,
        ], true);
    }
}
```

Create `app/Enums/Ogc/ResultCacheStatus.php`:

```php
<?php

namespace App\Enums\Ogc;

enum ResultCacheStatus: string
{
    case MetadataOnly = 'metadata_only';
    case Cached = 'cached';
    case Unsupported = 'unsupported';
    case Failed = 'failed';
}
```

- [ ] **Step 5: Implement the HTTP client**

Create `app/Services/Ogc/OgcProcessesClient.php`:

```php
<?php

namespace App\Services\Ogc;

use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

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

    public function jobResults(string $jobId): Response
    {
        return $this->request()
            ->get($this->path("/jobs/{$jobId}/results"), ['f' => 'json'])
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

    private function request(): \Illuminate\Http\Client\PendingRequest
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
        $baseUrl = rtrim((string) config('services.ogc_processes.base_url'), '/');

        return $baseUrl.'/'.Str::of($path)->trim('/')->toString();
    }
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/OgcProcessesClientTest.php
```

Expected: all tests in `OgcProcessesClientTest.php` pass.

- [ ] **Step 7: Format and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
git add config/services.php app/Enums/Ogc app/Services/Ogc/OgcProcessesClient.php tests/Fixtures/Ogc tests/Unit/Ogc/OgcProcessesClientTest.php
git commit -m "Add OGC processes HTTP client"
```

Expected: commit succeeds.

---

## Task 2: Persistence Models, Migrations, Factories, And Ownership

**Files:**
- Create: `database/migrations/*_create_process_executions_table.php`
- Create: `database/migrations/*_create_process_execution_results_table.php`
- Create: `database/migrations/*_create_notifications_table.php`
- Create: `app/Models/ProcessExecution.php`
- Create: `app/Models/ProcessExecutionResult.php`
- Modify: `app/Models/User.php`
- Create: `database/factories/ProcessExecutionFactory.php`
- Create: `database/factories/ProcessExecutionResultFactory.php`
- Create: `app/Policies/ProcessExecutionPolicy.php`
- Test: `tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php`

- [ ] **Step 1: Generate framework files**

Run:

```bash
php artisan make:model ProcessExecution --factory --no-interaction
php artisan make:model ProcessExecutionResult --factory --no-interaction
php artisan make:migration create_process_executions_table --no-interaction
php artisan make:migration create_process_execution_results_table --no-interaction
php artisan make:notifications-table --no-interaction
php artisan make:policy ProcessExecutionPolicy --model=ProcessExecution --no-interaction
php artisan make:test --pest Ogc/ProcessExecutionAuthorizationTest
```

Expected: the model, factory, migration, policy, and test files are created.

- [ ] **Step 2: Write the authorization/model test**

Replace `tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php`:

```php
<?php

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;

test('a user owns many process executions', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    expect($user->processExecutions()->first()->is($execution))->toBeTrue();
});

test('process execution casts structured fields and enums', function () {
    $execution = ProcessExecution::factory()->create([
        'execution_mode' => ExecutionMode::Async,
        'status' => ExecutionStatus::Accepted,
        'request_payload' => ['inputs' => ['lat' => 14.47]],
        'requested_outputs' => ['invasion_map' => ['transmissionMode' => 'reference']],
    ]);

    expect($execution->execution_mode)->toBe(ExecutionMode::Async)
        ->and($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->request_payload['inputs']['lat'])->toBe(14.47)
        ->and($execution->requested_outputs)->toHaveKey('invasion_map');
});

test('process execution has many results', function () {
    $execution = ProcessExecution::factory()->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    expect($execution->results()->first()->is($result))->toBeTrue();
});

test('users cannot view another users execution', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    expect($otherUser->can('view', $execution))->toBeFalse()
        ->and($owner->can('view', $execution))->toBeTrue();
});
```

- [ ] **Step 3: Run test and confirm it fails**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php
```

Expected: failure due to missing model fields, casts, relationships, and tables.

- [ ] **Step 4: Implement migrations**

Update `database/migrations/*_create_process_executions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('process_executions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('process_id')->index();
            $table->string('process_title')->nullable();
            $table->string('process_version')->nullable();
            $table->string('execution_mode');
            $table->string('remote_job_id')->nullable()->index();
            $table->string('status')->index();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->text('message')->nullable();
            $table->json('request_payload');
            $table->json('requested_outputs')->nullable();
            $table->timestamp('remote_created_at')->nullable();
            $table->timestamp('remote_started_at')->nullable();
            $table->timestamp('remote_finished_at')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'last_polled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('process_executions');
    }
};
```

Update `database/migrations/*_create_process_execution_results_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('process_execution_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('process_execution_id')->constrained()->cascadeOnDelete();
            $table->string('output_id');
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('media_type')->nullable();
            $table->string('transmission_mode')->nullable();
            $table->text('remote_href')->nullable();
            $table->string('storage_path')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('cache_status');
            $table->json('preview')->nullable();
            $table->timestamps();

            $table->unique(['process_execution_id', 'output_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('process_execution_results');
    }
};
```

Keep the generated notifications migration unchanged unless it uses an unsupported morph key for this app. Users use integer IDs, so the generated `morphs('notifiable')` shape is correct.

- [ ] **Step 5: Implement models, factories, and policy**

Replace `app/Models/ProcessExecution.php`:

```php
<?php

namespace App\Models;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use Database\Factories\ProcessExecutionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'process_id',
    'process_title',
    'process_version',
    'execution_mode',
    'remote_job_id',
    'status',
    'progress',
    'message',
    'request_payload',
    'requested_outputs',
    'remote_created_at',
    'remote_started_at',
    'remote_finished_at',
    'last_polled_at',
    'submitted_at',
    'completed_at',
    'failed_at',
])]
class ProcessExecution extends Model
{
    /** @use HasFactory<ProcessExecutionFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<User, ProcessExecution>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<ProcessExecutionResult>
     */
    public function results(): HasMany
    {
        return $this->hasMany(ProcessExecutionResult::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'execution_mode' => ExecutionMode::class,
            'status' => ExecutionStatus::class,
            'request_payload' => 'array',
            'requested_outputs' => 'array',
            'remote_created_at' => 'datetime',
            'remote_started_at' => 'datetime',
            'remote_finished_at' => 'datetime',
            'last_polled_at' => 'datetime',
            'submitted_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
```

Replace `app/Models/ProcessExecutionResult.php`:

```php
<?php

namespace App\Models;

use App\Enums\Ogc\ResultCacheStatus;
use Database\Factories\ProcessExecutionResultFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'process_execution_id',
    'output_id',
    'title',
    'description',
    'media_type',
    'transmission_mode',
    'remote_href',
    'storage_path',
    'size_bytes',
    'cache_status',
    'preview',
])]
class ProcessExecutionResult extends Model
{
    /** @use HasFactory<ProcessExecutionResultFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<ProcessExecution, ProcessExecutionResult>
     */
    public function processExecution(): BelongsTo
    {
        return $this->belongsTo(ProcessExecution::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cache_status' => ResultCacheStatus::class,
            'preview' => 'array',
        ];
    }
}
```

Add this method to `app/Models/User.php`:

```php
    /**
     * @return HasMany<ProcessExecution>
     */
    public function processExecutions(): HasMany
    {
        return $this->hasMany(ProcessExecution::class);
    }
```

Replace `database/factories/ProcessExecutionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\ProcessExecution>
 */
class ProcessExecutionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'process_id' => 'conduit',
            'process_title' => 'CONDUIT',
            'process_version' => '2.2.0',
            'execution_mode' => ExecutionMode::Async,
            'remote_job_id' => $this->faker->uuid(),
            'status' => ExecutionStatus::Accepted,
            'progress' => 5,
            'message' => 'Job accepted and ready for execution',
            'request_payload' => ['inputs' => ['lat' => 14.47]],
            'requested_outputs' => ['gas' => ['transmissionMode' => 'value']],
            'submitted_at' => now(),
        ];
    }
}
```

Replace `database/factories/ProcessExecutionResultFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\ProcessExecutionResult>
 */
class ProcessExecutionResultFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'process_execution_id' => ProcessExecution::factory(),
            'output_id' => 'gas',
            'title' => 'Plot gas volume fraction',
            'description' => 'Profile of gas volume fraction.',
            'media_type' => 'application/json',
            'transmission_mode' => 'value',
            'remote_href' => null,
            'storage_path' => null,
            'size_bytes' => null,
            'cache_status' => ResultCacheStatus::Cached,
            'preview' => ['kind' => 'chart', 'data' => ['chartType' => 'line']],
        ];
    }
}
```

Replace `app/Policies/ProcessExecutionPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\ProcessExecution;
use App\Models\User;

class ProcessExecutionPolicy
{
    public function view(User $user, ProcessExecution $processExecution): bool
    {
        return $processExecution->user()->is($user);
    }
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php
```

Expected: all tests in `ProcessExecutionAuthorizationTest.php` pass.

- [ ] **Step 7: Format and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
git add app/Enums/Ogc app/Models app/Policies database/factories database/migrations tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php
git commit -m "Add OGC execution persistence"
```

Expected: commit succeeds.

---

## Task 3: Process Schema Normalizer

**Files:**
- Create: `app/Services/Ogc/ProcessSchemaNormalizer.php`
- Test: `tests/Unit/Ogc/ProcessSchemaNormalizerTest.php`

- [ ] **Step 1: Create the unit test**

Create `tests/Unit/Ogc/ProcessSchemaNormalizerTest.php`:

```php
<?php

use App\Services\Ogc\ProcessSchemaNormalizer;
use Tests\TestCase;

uses(TestCase::class);

test('it normalizes scalar object and enum fields', function () {
    $process = ogcFixture('process-conduit');

    $normalized = app(ProcessSchemaNormalizer::class)->normalize($process);

    expect($normalized['id'])->toBe('conduit')
        ->and($normalized['jobControlOptions'])->toBe(['async-execute', 'sync-execute'])
        ->and($normalized['fields']['melt_composition']['kind'])->toBe('object')
        ->and($normalized['fields']['melt_composition']['fields']['sio2']['kind'])->toBe('scalar')
        ->and($normalized['fields']['geometry']['fields']['g']['kind'])->toBe('enum')
        ->and($normalized['outputs']['gas']['mediaType'])->toBe('application/json');
});

test('it normalizes one of variants', function () {
    $process = ogcFixture('process-conduit');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['searching_mode'];

    expect($field['kind'])->toBe('oneOf')
        ->and($field['variants'])->toHaveCount(2)
        ->and($field['variants'][0]['fields'])->toHaveKey('d')
        ->and($field['variants'][1]['fields'])->toHaveKey('f');
});

test('it normalizes array tables', function () {
    $process = ogcFixture('process-solwcad');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['sw.data'];

    expect($field['kind'])->toBe('array_table')
        ->and($field['minItems'])->toBe(1)
        ->and($field['columns'])->toHaveCount(14);
});

test('it normalizes repeatable object arrays', function () {
    $process = ogcFixture('process-pybox');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['multiple_values'];

    expect($field['kind'])->toBe('array_object')
        ->and($field['fields'])->toHaveKeys(['eps0', 'rhos', 'ds'])
        ->and($field['maxItems'])->toBe(21);
});
```

- [ ] **Step 2: Run test and confirm it fails**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
```

Expected: failure because `ProcessSchemaNormalizer` does not exist.

- [ ] **Step 3: Implement the normalizer**

Create `app/Services/Ogc/ProcessSchemaNormalizer.php`:

```php
<?php

namespace App\Services\Ogc;

use Illuminate\Support\Arr;

class ProcessSchemaNormalizer
{
    /**
     * @param  array<string, mixed>  $process
     * @return array<string, mixed>
     */
    public function normalize(array $process): array
    {
        return [
            'id' => (string) $process['id'],
            'title' => $process['title'] ?? $process['id'],
            'description' => $process['description'] ?? null,
            'version' => $process['version'] ?? null,
            'jobControlOptions' => $process['jobControlOptions'] ?? [],
            'outputTransmission' => $process['outputTransmission'] ?? [],
            'fields' => $this->normalizeInputs($process['inputs'] ?? []),
            'outputs' => $this->normalizeOutputs($process['outputs'] ?? []),
        ];
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    private function normalizeInputs(array $inputs): array
    {
        $fields = [];

        foreach ($inputs as $name => $input) {
            $fields[$name] = $this->normalizeField((string) $name, $input['schema'] ?? [], $input);
        }

        return $fields;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function normalizeField(string $name, array $schema, array $metadata = []): array
    {
        if (isset($schema['oneOf']) && is_array($schema['oneOf'])) {
            return [
                ...$this->baseField($name, $schema, $metadata),
                'kind' => 'oneOf',
                'variants' => collect($schema['oneOf'])
                    ->values()
                    ->map(fn (array $variant, int $index): array => [
                        'id' => (string) $index,
                        'label' => $variant['title'] ?? $variant['description'] ?? 'Variant '.($index + 1),
                        'description' => $variant['description'] ?? null,
                        'required' => $variant['required'] ?? [],
                        'fields' => $this->normalizeProperties($variant['properties'] ?? [], $variant['required'] ?? []),
                    ])
                    ->all(),
            ];
        }

        if (($schema['type'] ?? null) === 'object') {
            return [
                ...$this->baseField($name, $schema, $metadata),
                'kind' => 'object',
                'required' => $schema['required'] ?? [],
                'fields' => $this->normalizeProperties($schema['properties'] ?? [], $schema['required'] ?? []),
            ];
        }

        if (($schema['type'] ?? null) === 'array') {
            return $this->normalizeArrayField($name, $schema, $metadata);
        }

        if (isset($schema['enum'])) {
            return [
                ...$this->baseField($name, $schema, $metadata),
                'kind' => 'enum',
                'options' => $schema['enum'],
            ];
        }

        return [
            ...$this->baseField($name, $schema, $metadata),
            'kind' => 'scalar',
            'type' => $schema['type'] ?? 'string',
        ];
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function normalizeArrayField(string $name, array $schema, array $metadata): array
    {
        $items = $schema['items'] ?? [];

        if (($items['type'] ?? null) === 'array') {
            $columnCount = (int) ($items['maxItems'] ?? $items['minItems'] ?? 1);

            return [
                ...$this->baseField($name, $schema, $metadata),
                'kind' => 'array_table',
                'minItems' => $schema['minItems'] ?? null,
                'maxItems' => $schema['maxItems'] ?? null,
                'columns' => collect(range(1, $columnCount))
                    ->map(fn (int $column): array => [
                        'key' => (string) ($column - 1),
                        'label' => 'Column '.$column,
                        'type' => Arr::get($items, 'items.type', 'string'),
                    ])
                    ->all(),
            ];
        }

        if (($items['type'] ?? null) === 'object') {
            return [
                ...$this->baseField($name, $schema, $metadata),
                'kind' => 'array_object',
                'minItems' => $schema['minItems'] ?? null,
                'maxItems' => $schema['maxItems'] ?? null,
                'required' => $items['required'] ?? [],
                'fields' => $this->normalizeProperties($items['properties'] ?? [], $items['required'] ?? []),
            ];
        }

        return [
            ...$this->baseField($name, $schema, $metadata),
            'kind' => 'array_scalar',
            'minItems' => $schema['minItems'] ?? null,
            'maxItems' => $schema['maxItems'] ?? null,
            'itemType' => $items['type'] ?? 'string',
        ];
    }

    /**
     * @param  array<string, mixed>  $properties
     * @param  array<int, string>  $required
     * @return array<string, mixed>
     */
    private function normalizeProperties(array $properties, array $required): array
    {
        $fields = [];

        foreach ($properties as $name => $schema) {
            $fields[$name] = [
                ...$this->normalizeField((string) $name, $schema),
                'required' => in_array($name, $required, true),
            ];
        }

        return $fields;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function baseField(string $name, array $schema, array $metadata): array
    {
        return [
            'name' => $name,
            'title' => $metadata['title'] ?? $schema['title'] ?? $name,
            'description' => $metadata['description'] ?? $schema['description'] ?? null,
            'minOccurs' => $metadata['minOccurs'] ?? null,
            'maxOccurs' => $metadata['maxOccurs'] ?? null,
            'minimum' => $schema['minimum'] ?? null,
            'maximum' => $schema['maximum'] ?? null,
            'exclusiveMinimum' => $schema['exclusiveMinimum'] ?? null,
            'exclusiveMaximum' => $schema['exclusiveMaximum'] ?? null,
            'pattern' => $schema['pattern'] ?? null,
            'mediaType' => $schema['contentMediaType'] ?? null,
            'contentEncoding' => $schema['contentEncoding'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $outputs
     * @return array<string, mixed>
     */
    private function normalizeOutputs(array $outputs): array
    {
        $normalized = [];

        foreach ($outputs as $name => $output) {
            $schema = $output['schema'] ?? [];

            $normalized[$name] = [
                'name' => $name,
                'title' => $output['title'] ?? $name,
                'description' => $output['description'] ?? null,
                'mediaType' => $schema['contentMediaType'] ?? null,
                'contentEncoding' => $schema['contentEncoding'] ?? null,
                'schemaRef' => $schema['$ref'] ?? null,
            ];
        }

        return $normalized;
    }
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
```

Expected: all tests in `ProcessSchemaNormalizerTest.php` pass.

- [ ] **Step 5: Format and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Ogc/ProcessSchemaNormalizer.php tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
git commit -m "Normalize OGC process schemas"
```

Expected: commit succeeds.

---

## Task 4: Execution Actions, Polling Job, Result Storage, And Notifications

**Files:**
- Create: `app/Actions/Ogc/StartProcessExecution.php`
- Create: `app/Actions/Ogc/PollProcessExecution.php`
- Create: `app/Actions/Ogc/StoreProcessResult.php`
- Create: `app/Jobs/Ogc/PollProcessExecutionJob.php`
- Create: `app/Notifications/Ogc/ProcessExecutionCompleted.php`
- Create: `tests/Fixtures/Ogc/job-successful.json`
- Create: `tests/Fixtures/Ogc/job-failed.json`
- Create: `tests/Fixtures/Ogc/chart-result.json`
- Test: `tests/Feature/Ogc/ProcessExecutionTest.php`
- Test: `tests/Feature/Ogc/PollProcessExecutionJobTest.php`

- [ ] **Step 1: Generate test and job/notification files**

Run:

```bash
php artisan make:test --pest Ogc/ProcessExecutionTest
php artisan make:test --pest Ogc/PollProcessExecutionJobTest
php artisan make:job Ogc/PollProcessExecutionJob --no-interaction
php artisan make:notification Ogc/ProcessExecutionCompleted --no-interaction
```

Expected: files are created.

- [ ] **Step 2: Add result/job fixtures**

Create `tests/Fixtures/Ogc/job-successful.json`:

```json
{
  "type": "process",
  "processID": "conduit",
  "jobID": "job-123",
  "status": "successful",
  "message": "Job complete",
  "progress": 100,
  "parameters": null,
  "created": "2026-05-26T09:13:16.389136",
  "started": "2026-05-26T09:13:16.389186",
  "finished": "2026-05-26T09:13:28.289299",
  "updated": "2026-05-26T09:13:28.289327",
  "links": [
    {
      "href": "https://voice.pi.ingv.it/geoinquire/jobs/job-123/results",
      "rel": "http://www.opengis.net/def/rel/ogc/1.0/results",
      "type": "application/json",
      "title": "Results of job job-123 as application/json"
    }
  ]
}
```

Create `tests/Fixtures/Ogc/job-failed.json`:

```json
{
  "type": "process",
  "processID": "solwcad",
  "jobID": "job-456",
  "status": "failed",
  "message": "InvalidParameterValue: Error executing process",
  "progress": 5,
  "parameters": null,
  "created": "2026-06-05T15:15:44.269914",
  "started": "2026-06-05T15:15:44.278904",
  "finished": "2026-06-05T15:15:52.506850",
  "updated": "2026-06-05T15:15:52.506889"
}
```

Create `tests/Fixtures/Ogc/chart-result.json`:

```json
{
  "chartType": "line",
  "domain": {
    "key": "Conduit length",
    "label": "Conduit length",
    "unit": "m",
    "values": [0, 1, 2]
  },
  "series": [
    {
      "key": "gas",
      "label": "Gas",
      "unit": "%",
      "values": [10, 20, 30]
    }
  ]
}
```

- [ ] **Step 3: Write execution and polling tests**

Replace `tests/Feature/Ogc/ProcessExecutionTest.php`:

```php
<?php

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

test('it stores a successful synchronous execution with preview result', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(ogcFixture('chart-result')),
    ]);

    $process = ogcFixture('process-conduit');
    $payload = [
        'inputs' => ['melt_composition' => ['sio2' => 0.7, 'tio2' => 0.01]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];

    $execution = app(\App\Actions\Ogc\StartProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: $payload,
        mode: ExecutionMode::Sync,
    );

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->results)->toHaveCount(1)
        ->and($execution->results->first()->preview['kind'])->toBe('chart');
});

test('it stores asynchronous execution and dispatches polling', function () {
    Bus::fake();

    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/pybox/execution' => Http::response([], 201, [
            'Location' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123',
        ]),
    ]);

    $execution = app(\App\Actions\Ogc\StartProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: ['inputs' => ['lat' => 14.47], 'outputs' => ['input_data']],
        mode: ExecutionMode::Async,
    );

    expect($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->remote_job_id)->toBe('job-123');

    Bus::assertDispatched(PollProcessExecutionJob::class);
});

test('it stores submission failures with original payload', function () {
    $user = User::factory()->create();

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'Bad input',
        ], 500),
    ]);

    $payload = ['inputs' => ['bad' => true]];

    $execution = app(\App\Actions\Ogc\StartProcessExecution::class)->handle(
        user: $user,
        process: ogcFixture('process-conduit'),
        payload: $payload,
        mode: ExecutionMode::Sync,
    );

    expect($execution->status)->toBe(ExecutionStatus::SubmissionFailed)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->message)->toContain('Bad input');
});
```

Replace `tests/Feature/Ogc/PollProcessExecutionJobTest.php`:

```php
<?php

use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

test('it marks successful jobs and stores results', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response(ogcFixture('chart-result')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(\App\Actions\Ogc\PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->progress)->toBe(100)
        ->and($execution->results)->toHaveCount(1);

    Notification::assertSentTo($execution->user, ProcessExecutionCompleted::class);
});

test('it marks failed jobs and notifies the user', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-456',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-456?f=json' => Http::response(ogcFixture('job-failed')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(\App\Actions\Ogc\PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Failed)
        ->and($execution->message)->toContain('InvalidParameterValue');

    Notification::assertSentTo($execution->user, ProcessExecutionCompleted::class);
});

test('it marks missing remote jobs', function () {
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'missing-job',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/missing-job?f=json' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'missing-job',
        ], 404),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(\App\Actions\Ogc\PollProcessExecution::class),
    );

    expect($execution->refresh()->status)->toBe(ExecutionStatus::RemoteMissing);
});
```

- [ ] **Step 4: Run tests and confirm they fail**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php
```

Expected: failures because action and notification classes are missing.

- [ ] **Step 5: Implement actions, job, and notification**

Create `app/Actions/Ogc/StartProcessExecution.php`:

```php
<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

class StartProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    /**
     * @param  array<string, mixed>  $process
     * @param  array<string, mixed>  $payload
     */
    public function handle(User $user, array $process, array $payload, ExecutionMode $mode): ProcessExecution
    {
        $execution = ProcessExecution::create([
            'user_id' => $user->id,
            'process_id' => (string) $process['id'],
            'process_title' => $process['title'] ?? $process['id'],
            'process_version' => $process['version'] ?? null,
            'execution_mode' => $mode,
            'status' => ExecutionStatus::Submitting,
            'progress' => 0,
            'request_payload' => $payload,
            'requested_outputs' => $payload['outputs'] ?? null,
            'submitted_at' => now(),
        ]);

        try {
            $response = $this->client->execute((string) $process['id'], $payload, $mode->preferHeader());
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

Create `app/Actions/Ogc/StoreProcessResult.php`:

```php
<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

class StoreProcessResult
{
    public function fromResponse(ProcessExecution $execution, Response $response): void
    {
        $mediaType = Str::of((string) $response->header('Content-Type'))->before(';')->trim()->toString();
        $body = $response->body();
        $json = $response->json();
        $outputId = array_key_first($execution->requested_outputs ?? []) ?? 'result';

        $execution->results()->updateOrCreate(
            ['output_id' => $outputId],
            [
                'title' => $outputId,
                'description' => null,
                'media_type' => $mediaType ?: 'application/json',
                'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'value'),
                'remote_href' => null,
                'storage_path' => null,
                'size_bytes' => strlen($body),
                'cache_status' => ResultCacheStatus::Cached,
                'preview' => $this->preview($mediaType, $json, $body),
            ],
        );
    }

    /**
     * @param  array<string, mixed>|null  $json
     * @return array<string, mixed>
     */
    private function preview(string $mediaType, ?array $json, string $body): array
    {
        if (is_array($json) && isset($json['chartType'], $json['domain'], $json['series'])) {
            return ['kind' => 'chart', 'data' => $json];
        }

        if (is_array($json)) {
            return ['kind' => 'json', 'data' => $json];
        }

        if ($mediaType === 'text/csv') {
            return ['kind' => 'csv', 'data' => str($body)->limit(50000)->toString()];
        }

        if (str_starts_with($mediaType, 'text/')) {
            return ['kind' => 'text', 'data' => str($body)->limit(50000)->toString()];
        }

        return ['kind' => 'binary', 'data' => ['mediaType' => $mediaType]];
    }
}
```

Create `app/Actions/Ogc/PollProcessExecution.php`:

```php
<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;

class PollProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    public function handle(ProcessExecution $execution): void
    {
        if ($execution->status->isTerminal() || blank($execution->remote_job_id)) {
            return;
        }

        try {
            $job = $this->client->job($execution->remote_job_id);
        } catch (RequestException $exception) {
            if ($exception->response->status() === 404) {
                $execution->update([
                    'status' => ExecutionStatus::RemoteMissing,
                    'message' => $exception->response->json('description') ?? 'Remote job is missing.',
                    'failed_at' => now(),
                    'last_polled_at' => now(),
                ]);

                return;
            }

            throw $exception;
        }

        $status = $this->statusFromRemote((string) ($job['status'] ?? 'running'));

        $execution->update([
            'status' => $status,
            'progress' => (int) ($job['progress'] ?? $execution->progress),
            'message' => $job['message'] ?? $execution->message,
            'remote_created_at' => $this->parseRemoteDate($job['created'] ?? null),
            'remote_started_at' => $this->parseRemoteDate($job['started'] ?? null),
            'remote_finished_at' => $this->parseRemoteDate($job['finished'] ?? null),
            'last_polled_at' => now(),
            'completed_at' => $status === ExecutionStatus::Successful ? now() : $execution->completed_at,
            'failed_at' => $status === ExecutionStatus::Failed ? now() : $execution->failed_at,
        ]);

        $execution->refresh();

        if ($execution->status === ExecutionStatus::Successful) {
            $this->storeProcessResult->fromResponse($execution, $this->client->jobResults($execution->remote_job_id));
            $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());

            return;
        }

        if ($execution->status === ExecutionStatus::Failed) {
            $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());

            return;
        }

        PollProcessExecutionJob::dispatch($execution->id)->delay(now()->addSeconds(10));
    }

    private function statusFromRemote(string $status): ExecutionStatus
    {
        return match ($status) {
            'accepted' => ExecutionStatus::Accepted,
            'running' => ExecutionStatus::Running,
            'successful' => ExecutionStatus::Successful,
            'failed' => ExecutionStatus::Failed,
            default => ExecutionStatus::Running,
        };
    }

    private function parseRemoteDate(?string $date): ?\Carbon\CarbonImmutable
    {
        return filled($date) ? \Carbon\CarbonImmutable::parse($date) : null;
    }
}
```

Replace `app/Jobs/Ogc/PollProcessExecutionJob.php`:

```php
<?php

namespace App\Jobs\Ogc;

use App\Actions\Ogc\PollProcessExecution;
use App\Models\ProcessExecution;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class PollProcessExecutionJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 20;

    public function __construct(public int $processExecutionId) {}

    public function handle(PollProcessExecution $pollProcessExecution): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if ($execution === null) {
            return;
        }

        $pollProcessExecution->handle($execution);
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [new WithoutOverlapping("process-execution-{$this->processExecutionId}")];
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

Replace `app/Notifications/Ogc/ProcessExecutionCompleted.php`:

```php
<?php

namespace App\Notifications\Ogc;

use App\Models\ProcessExecution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class ProcessExecutionCompleted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ProcessExecution $execution) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): DatabaseMessage
    {
        return new DatabaseMessage([
            'process_execution_id' => $this->execution->id,
            'process_id' => $this->execution->process_id,
            'process_title' => $this->execution->process_title,
            'status' => $this->execution->status->value,
            'message' => $this->execution->message,
        ]);
    }
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php
```

Expected: all tests in both files pass.

- [ ] **Step 7: Format and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
git add app/Actions/Ogc app/Jobs/Ogc app/Notifications/Ogc tests/Fixtures/Ogc tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php
git commit -m "Add OGC execution actions and polling"
```

Expected: commit succeeds.

---

## Task 5: Controllers, Routes, Requests, And Wayfinder

**Files:**
- Create: `app/Http/Controllers/Ogc/ProcessController.php`
- Create: `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- Create: `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`
- Create: `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php`
- Modify: `routes/web.php`
- Generated: `resources/js/actions/App/Http/Controllers/Ogc/*`
- Generated: `resources/js/routes/processes/*`
- Generated: `resources/js/routes/process-executions/*`
- Test: `tests/Feature/Ogc/ProcessCatalogTest.php`
- Test: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Generate files**

Run:

```bash
php artisan make:controller Ogc/ProcessController --no-interaction
php artisan make:controller Ogc/ProcessExecutionController --no-interaction
php artisan make:controller Ogc/ProcessExecutionResultController --no-interaction
php artisan make:request Ogc/StoreProcessExecutionRequest --no-interaction
php artisan make:test --pest Ogc/ProcessCatalogTest
php artisan make:test --pest Ogc/ProcessExecutionResultTest
```

Expected: controller, request, and test files are created.

- [ ] **Step 2: Write feature tests**

Replace `tests/Feature/Ogc/ProcessCatalogTest.php`:

```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

test('guests cannot access process catalog', function () {
    $this->get('/processes')->assertRedirect(route('login'));
});

test('authenticated users can view process catalog', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->has('processes', 3));
});

test('authenticated users can view process detail with normalized schema', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('process.id', 'conduit')
            ->has('formSchema.fields.melt_composition'));
});
```

Replace `tests/Feature/Ogc/ProcessExecutionResultTest.php`:

```php
<?php

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

test('users can view their execution detail', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->has('execution.results', 1));
});

test('users cannot view another users execution detail', function () {
    $execution = ProcessExecution::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get("/process-executions/{$execution->id}")
        ->assertForbidden();
});

test('users can download cached result files', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'outfile',
        'media_type' => 'text/csv',
        'storage_path' => 'ogc-results/outfile.csv',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/outfile.csv', "a,b\n1,2\n");

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv');
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessCatalogTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: route/controller failures.

- [ ] **Step 4: Implement request, controllers, and routes**

Replace `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php`:

```php
<?php

namespace App\Http\Requests\Ogc;

use App\Enums\Ogc\ExecutionMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProcessExecutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::enum(ExecutionMode::class)],
            'inputs' => ['required', 'array'],
            'outputs' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function executionPayload(): array
    {
        return array_filter([
            'inputs' => $this->validated('inputs'),
            'outputs' => $this->validated('outputs'),
        ], fn (mixed $value): bool => $value !== null);
    }

    public function executionMode(): ExecutionMode
    {
        return ExecutionMode::from((string) $this->validated('mode'));
    }
}
```

Replace `app/Http/Controllers/Ogc/ProcessController.php`:

```php
<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Services\Ogc\OgcProcessesClient;
use App\Services\Ogc\ProcessSchemaNormalizer;
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

        return Inertia::render('processes/show', [
            'process' => $description,
            'formSchema' => $this->normalizer->normalize($description),
        ]);
    }
}
```

Replace `app/Http/Controllers/Ogc/ProcessExecutionController.php`:

```php
<?php

namespace App\Http\Controllers\Ogc;

use App\Actions\Ogc\StartProcessExecution;
use App\Http\Controllers\Controller;
use App\Http\Requests\Ogc\StoreProcessExecutionRequest;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProcessExecutionController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('process-executions/index', [
            'executions' => $request->user()
                ->processExecutions()
                ->latest()
                ->paginate(15)
                ->through(fn (ProcessExecution $execution): array => [
                    'id' => $execution->id,
                    'processId' => $execution->process_id,
                    'processTitle' => $execution->process_title,
                    'status' => $execution->status->value,
                    'progress' => $execution->progress,
                    'message' => $execution->message,
                    'createdAt' => $execution->created_at?->toISOString(),
                ]),
        ]);
    }

    public function store(
        StoreProcessExecutionRequest $request,
        string $process,
        OgcProcessesClient $client,
        StartProcessExecution $startProcessExecution,
    ): RedirectResponse {
        $execution = $startProcessExecution->handle(
            user: $request->user(),
            process: $client->process($process),
            payload: $request->executionPayload(),
            mode: $request->executionMode(),
        );

        return redirect()->route('process-executions.show', $execution);
    }

    public function show(Request $request, ProcessExecution $processExecution): Response
    {
        $this->authorize('view', $processExecution);

        $processExecution->load('results');

        return Inertia::render('process-executions/show', [
            'execution' => [
                'id' => $processExecution->id,
                'processId' => $processExecution->process_id,
                'processTitle' => $processExecution->process_title,
                'processVersion' => $processExecution->process_version,
                'status' => $processExecution->status->value,
                'progress' => $processExecution->progress,
                'message' => $processExecution->message,
                'requestPayload' => $processExecution->request_payload,
                'requestedOutputs' => $processExecution->requested_outputs,
                'results' => $processExecution->results->map(fn ($result): array => [
                    'id' => $result->id,
                    'outputId' => $result->output_id,
                    'title' => $result->title,
                    'description' => $result->description,
                    'mediaType' => $result->media_type,
                    'cacheStatus' => $result->cache_status->value,
                    'preview' => $result->preview,
                ])->all(),
            ],
        ]);
    }
}
```

Replace `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`:

```php
<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class ProcessExecutionResultController extends Controller
{
    public function download(ProcessExecution $processExecution, ProcessExecutionResult $result): Response
    {
        $this->authorize('view', $processExecution);
        abort_unless($result->process_execution_id === $processExecution->id, 404);
        abort_unless(filled($result->storage_path), 404);

        return response(Storage::disk('local')->get($result->storage_path), 200, [
            'Content-Type' => $result->media_type ?: 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="'.$result->output_id.'"',
        ]);
    }
}
```

Add imports to `routes/web.php`:

```php
use App\Http\Controllers\Ogc\ProcessController;
use App\Http\Controllers\Ogc\ProcessExecutionController;
use App\Http\Controllers\Ogc\ProcessExecutionResultController;
```

Add routes inside the existing `Route::middleware(['auth', 'verified'])->group(function () { ... });` block:

```php
    Route::get('processes', [ProcessController::class, 'index'])
        ->name('processes.index');

    Route::get('processes/{process}', [ProcessController::class, 'show'])
        ->name('processes.show');

    Route::post('processes/{process}/executions', [ProcessExecutionController::class, 'store'])
        ->name('processes.executions.store');

    Route::get('process-executions', [ProcessExecutionController::class, 'index'])
        ->name('process-executions.index');

    Route::get('process-executions/{processExecution}', [ProcessExecutionController::class, 'show'])
        ->name('process-executions.show');

    Route::get('process-executions/{processExecution}/results/{result}/download', [ProcessExecutionResultController::class, 'download'])
        ->name('process-executions.results.download');
```

- [ ] **Step 5: Regenerate Wayfinder**

Run:

```bash
php artisan wayfinder:generate --with-form --no-interaction
```

Expected: new generated files appear under `resources/js/actions/App/Http/Controllers/Ogc` and route helpers under `resources/js/routes`.

- [ ] **Step 6: Verify feature tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessCatalogTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: all tests pass.

- [ ] **Step 7: Format and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Ogc app/Http/Requests/Ogc routes/web.php resources/js/actions resources/js/routes tests/Feature/Ogc/ProcessCatalogTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "Add OGC process routes and controllers"
```

Expected: commit succeeds.

---

## Task 6: Frontend Pages And Navigation Skeleton

**Files:**
- Create: `resources/js/types/ogc.ts`
- Modify: `resources/js/types/index.ts`
- Create: `resources/js/pages/processes/index.tsx`
- Create: `resources/js/pages/processes/show.tsx`
- Create: `resources/js/pages/process-executions/index.tsx`
- Create: `resources/js/pages/process-executions/show.tsx`
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Add OGC TypeScript types**

Create `resources/js/types/ogc.ts`:

```ts
export type OgcProcessSummary = {
    id: string;
    title?: string;
    description?: string;
    version?: string;
    jobControlOptions?: string[];
    outputTransmission?: string[];
};

export type OgcNormalizedField = {
    name: string;
    title: string;
    description?: string | null;
    kind:
        | 'scalar'
        | 'enum'
        | 'object'
        | 'oneOf'
        | 'array_object'
        | 'array_table'
        | 'array_scalar';
    type?: string;
    required?: boolean | string[];
    fields?: Record<string, OgcNormalizedField>;
    variants?: {
        id: string;
        label: string;
        description?: string | null;
        required: string[];
        fields: Record<string, OgcNormalizedField>;
    }[];
    options?: Array<string | number | boolean>;
    minItems?: number | null;
    maxItems?: number | null;
    columns?: { key: string; label: string; type: string }[];
    minimum?: number | null;
    maximum?: number | null;
    exclusiveMinimum?: number | null;
    exclusiveMaximum?: number | null;
    pattern?: string | null;
    mediaType?: string | null;
    contentEncoding?: string | null;
};

export type OgcNormalizedOutput = {
    name: string;
    title: string;
    description?: string | null;
    mediaType?: string | null;
    contentEncoding?: string | null;
    schemaRef?: string | null;
};

export type OgcFormSchema = {
    id: string;
    title: string;
    description?: string | null;
    version?: string | null;
    jobControlOptions: string[];
    outputTransmission: string[];
    fields: Record<string, OgcNormalizedField>;
    outputs: Record<string, OgcNormalizedOutput>;
};

export type ProcessExecutionListItem = {
    id: number;
    processId: string;
    processTitle?: string | null;
    status: string;
    progress: number;
    message?: string | null;
    createdAt?: string | null;
};

export type ProcessExecutionResult = {
    id: number;
    outputId: string;
    title?: string | null;
    description?: string | null;
    mediaType?: string | null;
    cacheStatus: string;
    preview?: { kind: string; data: unknown } | null;
};

export type ProcessExecutionDetail = ProcessExecutionListItem & {
    processVersion?: string | null;
    requestPayload: Record<string, unknown>;
    requestedOutputs?: Record<string, unknown> | null;
    results: ProcessExecutionResult[];
};
```

Modify `resources/js/types/index.ts`:

```ts
export type * from './auth';
export type * from './navigation';
export type * from './ogc';
export type * from './ui';
```

- [ ] **Step 2: Add process list page**

Create `resources/js/pages/processes/index.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import { Cpu, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { show } from '@/routes/processes';
import type { OgcProcessSummary } from '@/types';

export default function ProcessIndex({
    processes,
}: {
    processes: OgcProcessSummary[];
}) {
    return (
        <>
            <Head title="Processes" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">Processes</h1>
                        <p className="text-sm text-muted-foreground">
                            Available OGC API processes from Geo-INQUIRE.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {processes.map((process) => (
                        <Card key={process.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>{process.title ?? process.id}</CardTitle>
                                        <CardDescription>{process.id}</CardDescription>
                                    </div>
                                    <Cpu className="text-muted-foreground" data-icon="inline-start" />
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <p className="line-clamp-4 text-sm text-muted-foreground">
                                    {process.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {process.jobControlOptions?.map((option) => (
                                        <Badge key={option} variant="secondary">
                                            {option}
                                        </Badge>
                                    ))}
                                </div>
                                <Button asChild>
                                    <Link href={show(process.id)}>
                                        <PlayCircle data-icon="inline-start" />
                                        Open
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}
```

- [ ] **Step 3: Add detail/history pages that use component shells created in the next step**

Create `resources/js/pages/processes/show.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import type { OgcFormSchema } from '@/types';

export default function ProcessShow({
    formSchema,
}: {
    process: Record<string, unknown>;
    formSchema: OgcFormSchema;
}) {
    return (
        <>
            <Head title={formSchema.title} />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold">{formSchema.title}</h1>
                    <p className="text-sm text-muted-foreground">{formSchema.description}</p>
                </div>

                <DynamicProcessForm schema={formSchema} />
            </div>
        </>
    );
}
```

Create `resources/js/pages/process-executions/index.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { show } from '@/routes/process-executions';
import type { ProcessExecutionListItem } from '@/types';

type PaginatedExecutions = {
    data: ProcessExecutionListItem[];
};

export default function ProcessExecutionIndex({
    executions,
}: {
    executions: PaginatedExecutions;
}) {
    return (
        <>
            <Head title="Execution History" />

            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-semibold">Execution History</h1>

                <div className="flex flex-col gap-3">
                    {executions.data.map((execution) => (
                        <Card key={execution.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle>{execution.processTitle ?? execution.processId}</CardTitle>
                                    <Badge variant="secondary">{execution.status}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">{execution.message}</p>
                                <Button asChild variant="outline">
                                    <Link href={show(execution.id)}>Details</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}
```

Create `resources/js/pages/process-executions/show.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import ResultPreview from '@/components/ogc/result-preview';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { ProcessExecutionDetail } from '@/types';

export default function ProcessExecutionShow({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    return (
        <>
            <Head title={`Execution ${execution.id}`} />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">
                            {execution.processTitle ?? execution.processId}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Execution #{execution.id}
                        </p>
                    </div>
                    <Badge variant="secondary">{execution.status}</Badge>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Request Payload</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(execution.requestPayload, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-3">
                    {execution.results.map((result) => (
                        <ResultPreview
                            key={result.id}
                            executionId={execution.id}
                            result={result}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
```

- [ ] **Step 4: Add temporary component shells so TypeScript resolves**

Create `resources/js/components/ogc/dynamic-process-form.tsx`:

```tsx
import type { OgcFormSchema } from '@/types';

export default function DynamicProcessForm({ schema }: { schema: OgcFormSchema }) {
    return (
        <div className="rounded-md border p-4">
            <pre className="overflow-auto text-xs">{JSON.stringify(schema.fields, null, 2)}</pre>
        </div>
    );
}
```

Create `resources/js/components/ogc/result-preview.tsx`:

```tsx
import type { ProcessExecutionResult } from '@/types';

export default function ResultPreview({
    result,
}: {
    executionId: number;
    result: ProcessExecutionResult;
}) {
    return (
        <div className="rounded-md border p-4">
            <div className="font-medium">{result.title ?? result.outputId}</div>
            <pre className="mt-2 overflow-auto text-xs">
                {JSON.stringify(result.preview, null, 2)}
            </pre>
        </div>
    );
}
```

- [ ] **Step 5: Add sidebar navigation**

Modify `resources/js/components/app-sidebar.tsx`:

```tsx
import { History, LayoutGrid, Workflow } from 'lucide-react';
```

Update `mainNavItems`:

```tsx
const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Processes',
        href: processesIndex(),
        icon: Workflow,
    },
    {
        title: 'Executions',
        href: processExecutionsIndex(),
        icon: History,
    },
];
```

Add these imports:

```tsx
import { index as processesIndex } from '@/routes/processes';
import { index as processExecutionsIndex } from '@/routes/process-executions';
```

- [ ] **Step 6: Verify TypeScript**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes, or only reports import paths that need to match generated Wayfinder filenames. Fix imports using generated files, then rerun.

- [ ] **Step 7: Commit**

Run:

```bash
git add resources/js/types resources/js/pages/processes resources/js/pages/process-executions resources/js/components/ogc resources/js/components/app-sidebar.tsx
git commit -m "Add OGC process frontend pages"
```

Expected: commit succeeds.

---

## Task 7: Dynamic Form Components

**Files:**
- Modify: `resources/js/components/ogc/dynamic-process-form.tsx`
- Create: `resources/js/components/ogc/schema-field-renderer.tsx`
- Create: `resources/js/components/ogc/one-of-field.tsx`
- Create: `resources/js/components/ogc/array-object-field.tsx`
- Create: `resources/js/components/ogc/array-table-field.tsx`
- Create: `resources/js/components/ogc/output-selector.tsx`

- [ ] **Step 1: Implement output selector**

Create `resources/js/components/ogc/output-selector.tsx`:

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { OgcNormalizedOutput } from '@/types';

export default function OutputSelector({
    outputs,
    value,
    onChange,
}: {
    outputs: Record<string, OgcNormalizedOutput>;
    value: Record<string, { transmissionMode: string }>;
    onChange: (value: Record<string, { transmissionMode: string }>) => void;
}) {
    function toggle(outputId: string, checked: boolean) {
        const next = { ...value };

        if (checked) {
            next[outputId] = { transmissionMode: next[outputId]?.transmissionMode ?? 'value' };
        } else {
            delete next[outputId];
        }

        onChange(next);
    }

    function setTransmissionMode(outputId: string, transmissionMode: string) {
        onChange({
            ...value,
            [outputId]: { transmissionMode },
        });
    }

    return (
        <div className="flex flex-col gap-3">
            {Object.entries(outputs).map(([outputId, output]) => (
                <div key={outputId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            id={`output-${outputId}`}
                            checked={Boolean(value[outputId])}
                            onCheckedChange={(checked) => toggle(outputId, checked === true)}
                        />
                        <div className="flex flex-col gap-1">
                            <Label htmlFor={`output-${outputId}`}>{output.title}</Label>
                            <p className="text-xs text-muted-foreground">{output.mediaType}</p>
                        </div>
                    </div>

                    {value[outputId] && (
                        <Select
                            value={value[outputId].transmissionMode}
                            onValueChange={(mode) => setTransmissionMode(outputId, mode)}
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="value">Value</SelectItem>
                                    <SelectItem value="reference">Reference</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Implement field renderer and variants**

Create `resources/js/components/ogc/schema-field-renderer.tsx`:

```tsx
import ArrayObjectField from '@/components/ogc/array-object-field';
import ArrayTableField from '@/components/ogc/array-table-field';
import OneOfField from '@/components/ogc/one-of-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { OgcNormalizedField } from '@/types';

export default function SchemaFieldRenderer({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (field.kind === 'object' && field.fields) {
        const objectValue = isRecord(value) ? value : {};

        return (
            <fieldset className="flex flex-col gap-3 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">{field.title}</legend>
                {Object.entries(field.fields).map(([key, child]) => (
                    <SchemaFieldRenderer
                        key={key}
                        field={child}
                        value={objectValue[key]}
                        onChange={(nextValue) => onChange({ ...objectValue, [key]: nextValue })}
                    />
                ))}
            </fieldset>
        );
    }

    if (field.kind === 'oneOf') {
        return <OneOfField field={field} value={value} onChange={onChange} />;
    }

    if (field.kind === 'array_object') {
        return <ArrayObjectField field={field} value={value} onChange={onChange} />;
    }

    if (field.kind === 'array_table') {
        return <ArrayTableField field={field} value={value} onChange={onChange} />;
    }

    if (field.kind === 'enum') {
        return (
            <div className="flex flex-col gap-2">
                <Label>{field.title}</Label>
                <Select value={String(value ?? '')} onValueChange={onChange}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {field.options?.map((option) => (
                                <SelectItem key={String(option)} value={String(option)}>
                                    {String(option)}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <Label>{field.title}</Label>
            <Input
                type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                value={String(value ?? '')}
                min={field.minimum ?? field.exclusiveMinimum ?? undefined}
                max={field.maximum ?? field.exclusiveMaximum ?? undefined}
                onChange={(event) => {
                    const raw = event.target.value;
                    onChange(field.type === 'number' ? Number(raw) : field.type === 'integer' ? Number.parseInt(raw, 10) : raw);
                }}
            />
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        </div>
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Create `resources/js/components/ogc/one-of-field.tsx`:

```tsx
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { OgcNormalizedField } from '@/types';

type OneOfValue = {
    variant: string;
    value: Record<string, unknown>;
};

export default function OneOfField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const variants = field.variants ?? [];
    const current = isOneOfValue(value) ? value : { variant: variants[0]?.id ?? '0', value: {} };
    const selected = variants.find((variant) => variant.id === current.variant) ?? variants[0];

    if (!selected) {
        return null;
    }

    return (
        <fieldset className="flex flex-col gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{field.title}</legend>
            <Select
                value={current.variant}
                onValueChange={(variant) => onChange({ variant, value: {} })}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                                {variant.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>

            {Object.entries(selected.fields).map(([key, child]) => (
                <SchemaFieldRenderer
                    key={key}
                    field={child}
                    value={current.value[key]}
                    onChange={(nextValue) =>
                        onChange({
                            variant: current.variant,
                            value: { ...current.value, [key]: nextValue },
                        })
                    }
                />
            ))}
        </fieldset>
    );
}

function isOneOfValue(value: unknown): value is OneOfValue {
    return typeof value === 'object'
        && value !== null
        && 'variant' in value
        && 'value' in value;
}
```

Create `resources/js/components/ogc/array-object-field.tsx`:

```tsx
import { Plus, Trash2 } from 'lucide-react';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Button } from '@/components/ui/button';
import type { OgcNormalizedField } from '@/types';

export default function ArrayObjectField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const rows = Array.isArray(value) ? value : [];

    function updateRow(index: number, row: Record<string, unknown>) {
        onChange(rows.map((item, itemIndex) => (itemIndex === index ? row : item)));
    }

    return (
        <fieldset className="flex flex-col gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{field.title}</legend>
            {rows.map((row, index) => {
                const rowValue = isRecord(row) ? row : {};

                return (
                    <div key={index} className="flex flex-col gap-3 rounded-md border p-3">
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                            >
                                <Trash2 />
                            </Button>
                        </div>
                        {Object.entries(field.fields ?? {}).map(([key, child]) => (
                            <SchemaFieldRenderer
                                key={key}
                                field={child}
                                value={rowValue[key]}
                                onChange={(nextValue) => updateRow(index, { ...rowValue, [key]: nextValue })}
                            />
                        ))}
                    </div>
                );
            })}
            <Button type="button" variant="outline" onClick={() => onChange([...rows, {}])}>
                <Plus data-icon="inline-start" />
                Add row
            </Button>
        </fieldset>
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Create `resources/js/components/ogc/array-table-field.tsx`:

```tsx
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OgcNormalizedField } from '@/types';

export default function ArrayTableField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const rows = Array.isArray(value) ? value : [];
    const columns = field.columns ?? [];

    function updateCell(rowIndex: number, columnIndex: number, cellValue: string) {
        const nextRows = rows.map((row, currentRowIndex) => {
            const nextRow = Array.isArray(row) ? [...row] : [];

            if (currentRowIndex === rowIndex) {
                nextRow[columnIndex] = cellValue;
            }

            return nextRow;
        });

        onChange(nextRows);
    }

    return (
        <fieldset className="flex flex-col gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{field.title}</legend>
            <div className="overflow-auto">
                <table className="w-full min-w-[960px] text-sm">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key} className="p-1 text-left font-medium">
                                    {column.label}
                                </th>
                            ))}
                            <th className="w-10" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            const rowValues = Array.isArray(row) ? row : [];

                            return (
                                <tr key={rowIndex}>
                                    {columns.map((column, columnIndex) => (
                                        <td key={column.key} className="p-1">
                                            <Input
                                                value={String(rowValues[columnIndex] ?? '')}
                                                onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                                            />
                                        </td>
                                    ))}
                                    <td className="p-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Button
                type="button"
                variant="outline"
                onClick={() => onChange([...rows, columns.map(() => '')])}
            >
                <Plus data-icon="inline-start" />
                Add row
            </Button>
        </fieldset>
    );
}
```

- [ ] **Step 3: Implement DynamicProcessForm**

Replace `resources/js/components/ogc/dynamic-process-form.tsx`:

```tsx
import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import OutputSelector from '@/components/ogc/output-selector';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { store } from '@/routes/processes/executions';
import type { OgcFormSchema } from '@/types';

type FormData = {
    mode: 'sync' | 'async';
    inputs: Record<string, unknown>;
    outputs: Record<string, { transmissionMode: string }>;
};

export default function DynamicProcessForm({ schema }: { schema: OgcFormSchema }) {
    const initialMode = schema.jobControlOptions.includes('sync-execute') ? 'sync' : 'async';
    const { data, setData, submit, processing, errors } = useForm<FormData>({
        mode: initialMode,
        inputs: {},
        outputs: Object.fromEntries(
            Object.keys(schema.outputs).map((outputId) => [
                outputId,
                { transmissionMode: 'value' },
            ]),
        ),
    });

    function setInput(name: string, value: unknown) {
        setData('inputs', {
            ...data.inputs,
            [name]: normalizeValue(value),
        });
    }

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                submit(store(schema.id));
            }}
        >
            {Object.keys(errors).length > 0 && (
                <Alert variant="destructive">
                    <AlertDescription>
                        Check the highlighted fields and submit again.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Execution Mode</CardTitle>
                </CardHeader>
                <CardContent>
                    <ToggleGroup
                        type="single"
                        value={data.mode}
                        onValueChange={(value) => {
                            if (value === 'sync' || value === 'async') {
                                setData('mode', value);
                            }
                        }}
                    >
                        {schema.jobControlOptions.includes('sync-execute') && (
                            <ToggleGroupItem value="sync">Sync</ToggleGroupItem>
                        )}
                        {schema.jobControlOptions.includes('async-execute') && (
                            <ToggleGroupItem value="async">Async</ToggleGroupItem>
                        )}
                    </ToggleGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Inputs</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {Object.entries(schema.fields).map(([name, field]) => (
                        <SchemaFieldRenderer
                            key={name}
                            field={field}
                            value={data.inputs[name]}
                            onChange={(value) => setInput(name, value)}
                        />
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Outputs</CardTitle>
                </CardHeader>
                <CardContent>
                    <OutputSelector
                        outputs={schema.outputs}
                        value={data.outputs}
                        onChange={(outputs) => setData('outputs', outputs)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={processing}>
                    {processing && <Loader2 data-icon="inline-start" />}
                    Execute
                </Button>
            </div>
        </form>
    );
}

function normalizeValue(value: unknown): unknown {
    if (typeof value === 'object' && value !== null && 'variant' in value && 'value' in value) {
        return (value as { value: Record<string, unknown> }).value;
    }

    return value;
}
```

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add resources/js/components/ogc
git commit -m "Add dynamic OGC process form"
```

Expected: commit succeeds.

---

## Task 8: Result Preview And Download UI

**Files:**
- Modify: `resources/js/components/ogc/result-preview.tsx`

- [ ] **Step 1: Implement result preview UI**

Replace `resources/js/components/ogc/result-preview.tsx`:

```tsx
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { download } from '@/routes/process-executions/results';
import type { ProcessExecutionResult } from '@/types';

export default function ResultPreview({
    executionId,
    result,
}: {
    executionId: number;
    result: ProcessExecutionResult;
}) {
    const preview = result.preview;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{result.title ?? result.outputId}</CardTitle>
                        <CardDescription>{result.mediaType}</CardDescription>
                    </div>
                    {result.cacheStatus === 'cached' && (
                        <Button asChild variant="outline">
                            <a href={download.url([executionId, result.id])}>
                                <Download data-icon="inline-start" />
                                Download
                            </a>
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {preview?.kind === 'chart' && <ChartPreview data={preview.data} />}
                {preview?.kind === 'csv' && <CsvPreview data={preview.data} />}
                {preview?.kind === 'text' && <TextPreview data={preview.data} />}
                {preview?.kind === 'json' && <JsonPreview data={preview.data} />}
                {preview?.kind === 'binary' && (
                    <p className="text-sm text-muted-foreground">
                        Binary result available for download. Map preview is planned for the geospatial preview phase.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function ChartPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}

function CsvPreview({ data }: { data: unknown }) {
    const rows = String(data ?? '')
        .split('\n')
        .filter(Boolean)
        .slice(0, 20)
        .map((row) => row.split(','));

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {rows[0]?.map((cell, index) => (
                        <TableHead key={index}>{cell}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.slice(1).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function TextPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {String(data ?? '')}
        </pre>
    );
}

function JsonPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

Run:

```bash
test -f resources/js/components/ui/table.tsx || bunx --bun shadcn@latest add table
bunx tsc --noEmit
```

Expected: the shadcn table component exists and TypeScript passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add resources/js/components/ogc/result-preview.tsx resources/js/components/ui/table.tsx
git commit -m "Add OGC result previews"
```

Expected: commit succeeds.

---

## Task 9: Final Verification And Baseline Polish

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run backend OGC test suite**

Run:

```bash
php artisan test --compact tests/Unit/Ogc tests/Feature/Ogc
```

Expected: all OGC tests pass.

- [ ] **Step 2: Run full PHP feature smoke tests**

Run:

```bash
php artisan test --compact tests/Feature/DashboardTest.php tests/Feature/Ogc
```

Expected: dashboard and OGC feature tests pass.

- [ ] **Step 3: Run formatter**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint completes and formats dirty PHP files.

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 5: Run route list spot check**

Run:

```bash
php artisan route:list --path=process --except-vendor
```

Expected: routes for `processes.index`, `processes.show`, `processes.executions.store`, `process-executions.index`, `process-executions.show`, and `process-executions.results.download` are listed.

- [ ] **Step 6: Commit verification fixes**

If Step 1-5 required code changes, run:

```bash
git add -A
git commit -m "Polish OGC processes client"
```

Expected: commit succeeds when there are changes; skip this commit when `git status --short` is clean.

---

## Self-Review Checklist

- Spec coverage:
  - Process navigation: Task 1, Task 3, Task 5, Task 6.
  - Process detail and input/output schema: Task 3, Task 5, Task 6.
  - Dynamic form: Task 3, Task 7.
  - Execution POST sync/async: Task 1, Task 4, Task 5, Task 7.
  - Local user history and payload retention: Task 2, Task 4, Task 5, Task 6.
  - Job polling and states: Task 2, Task 4.
  - Result metadata and previews/downloads: Task 2, Task 4, Task 5, Task 8.
  - Auth and authorization: Task 2, Task 5.
  - React/Inertia/shadcn/Wayfinder: Task 5, Task 6, Task 7, Task 8.
  - Tests and verification: every task includes targeted tests or type checks.
- Placeholder scan: no unresolved implementation markers are intentionally left in this plan.
- Type consistency: `ExecutionMode`, `ExecutionStatus`, `ResultCacheStatus`, `ProcessExecution`, `ProcessExecutionResult`, and route names are used consistently across tasks.
