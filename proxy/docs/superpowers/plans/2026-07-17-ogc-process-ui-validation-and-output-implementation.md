# OGC Process UI Validation and Output Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the client-reported OGC process form validation, field presentation, output metadata, and optional SLD warning behavior without migrations or new dependencies.

**Architecture:** Keep the selected oneOf variant in the Inertia request until Laravel validates it, then remove only the application-owned variant marker while preserving the standard OGC value wrapper. Normalize required table columns from JSON Schema, route dotted backend errors to accessible React controls, derive grouped-result metadata from persisted process_outputs, and gate backend SLD diagnostics with an env-backed flag that defaults to false.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 3, React 19, TypeScript 5.9, Bun, Tailwind CSS 4.

---

## Design Reference

Implement the approved decisions in:

- docs/superpowers/specs/2026-07-17-ogc-process-ui-validation-and-output-design.md

The implementation is one coordinated client-feedback release, but it has two independently verifiable phases:

1. Tasks 1-4 correct normalized schemas, backend input validation, form state, inline errors, focus, enum defaults, and table requirements.
2. Tasks 5-6 correct result metadata, descriptions, and the configurable admin-only SLD diagnostic.

Task 7 verifies the combined acceptance criteria.

## File Structure

### Create

- app/Services/Ogc/ProcessInputPayloadBuilder.php
  - Remove the validated oneOf variant marker before persistence and remote submission while preserving the OGC value wrapper.
- tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
  - Prove exact payload cleanup and preservation of unrelated inputs.
- resources/js/lib/ogc-form-values.ts
  - Own pure default-value, example-value, and submit-value transformations.
- tests/Frontend/ogc-form-values.test.ts
  - Prove oneOf metadata retention, singleton enum defaults, and display-source wiring.
- resources/js/lib/ogc-form-errors.ts
  - Resolve dotted Inertia errors and focus the first invalid rendered control.
- tests/Frontend/ogc-form-errors.test.ts
  - Prove exact-path priority, structural fallback, and form wiring.

### Modify

- app/Services/Ogc/ProcessSchemaNormalizer.php
  - Remove numeric fallback labels from variants and mark required tuple columns.
- app/Services/Ogc/ProcessInputValidator.php
  - Validate the explicit variant, emit paths containing value, and reject blank required cells.
- app/Http/Controllers/Ogc/ProcessExecutionController.php
  - Use canonical input payloads, expose logical output metadata, and gate SLD analysis.
- config/services.php
  - Add the false-by-default map warning flag.
- .env.example
  - Document OGC_PROCESSES_SHOW_MAP_LAYER_WARNINGS.
- resources/js/types/ogc.ts
  - Add required column and logical output metadata types.
- resources/js/lib/ogc-fields.ts
  - Render enum values once instead of duplicated key/value labels.
- resources/js/components/ogc/dynamic-process-form.tsx
  - Use extracted form transforms, forward errors, and focus after failed submissions.
- resources/js/components/ogc/schema-field-renderer.tsx
  - Thread submitted paths and inline errors through every field kind.
- resources/js/components/ogc/one-of-field.tsx
  - Hide indexes, place the selector before the description, and expose variant/child errors.
- resources/js/components/ogc/array-table-field.tsx
  - Require schema-mandated cells and render per-cell errors.
- resources/js/components/ogc/array-object-field.tsx
  - Forward row-specific paths and errors.
- resources/js/components/ogc/data-input-field.tsx
  - Forward paths, accessibility state, and inline errors.
- resources/js/components/ogc/section-field-set.tsx
  - Provide a focusable structural-error target.
- resources/js/lib/ogc-result-groups.ts
  - Prefer persisted logical output metadata for map groups.
- resources/js/components/ogc/result-preview.tsx
  - Always render a non-empty result description.
- resources/js/pages/process-executions/show.tsx
  - Pass logical metadata into result grouping.
- tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
  - Cover index-free fallbacks and required table columns.
- tests/Unit/Ogc/ProcessInputValidatorTest.php
  - Cover explicit variants, legacy ambiguity, dotted paths, and blank cells.
- tests/Feature/Ogc/ProcessExecutionTest.php
  - Cover failed oneOf submission and exact canonical job payloads.
- tests/Feature/Ogc/ProcessExecutionResultTest.php
  - Cover logical metadata and both warning-flag states.
- tests/Frontend/ogc-fields.test.ts
  - Update enum label expectations.
- tests/Frontend/html-pattern.test.ts
  - Lock browser behavior for the old and proposed Solwcad patterns.
- tests/Frontend/ogc-outputs.test.ts
  - Cover logical metadata preference and ResultPreview description wiring.

## Prerequisites

- [ ] **Step 1: Create or enter an isolated worktree and confirm a clean baseline**

Use superpowers:using-git-worktrees before implementation if the current checkout is not already an isolated feature worktree.

Run:

```bash
git status --short
git branch --show-current
```

Expected: no uncommitted application changes. Preserve the two documentation commits already on the branch.

- [ ] **Step 2: Load the required implementation skills**

Use these skills before their corresponding edits:

- superpowers:test-driven-development before the first production edit;
- laravel-best-practices for PHP services and controllers;
- pest-testing for Pest test work;
- inertia-react-development for the Inertia form;
- tailwindcss-development for invalid-state styling;
- superpowers:verification-before-completion before claiming completion.

Do not add packages, migrations, routes, or database columns.

- [ ] **Step 3: Refresh installed-version documentation**

Use Laravel Boost search-docs with:

```text
packages: ["laravel/framework", "inertiajs/inertia-laravel", "@inertiajs/react", "pestphp/pest"]
queries: [
  "nested validation errors dot notation useForm onError",
  "form request validated nested arrays",
  "feature test assert validation errors queued jobs",
  "environment boolean configuration cache"
]
```

Expected: confirm dotted Inertia errors, useForm onError behavior, Laravel validated input access, queue fakes, and env values being consumed only through config files.

- [ ] **Step 4: Run the focused baseline**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php tests/Unit/Ogc/ProcessInputValidatorTest.php
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
bun test tests/Frontend/ogc-fields.test.ts tests/Frontend/html-pattern.test.ts tests/Frontend/ogc-outputs.test.ts
```

Expected: all existing tests pass before new RED tests are added.

## Task 1: Normalize Index-Free Variants and Required Table Columns

**Files:**

- Modify: app/Services/Ogc/ProcessSchemaNormalizer.php:51-202
- Modify: resources/js/types/ogc.ts:12-45
- Modify: tests/Unit/Ogc/ProcessSchemaNormalizerTest.php:83-137

- [ ] **Step 1: Write failing normalizer tests**

Replace the description-only fallback assertion and extend the table test with:

```php
test('it keeps long one of descriptions out of compact index free labels', function () {
    $process = [
        'id' => 'description-only',
        'inputs' => [
            'mode' => [
                'schema' => [
                    'type' => 'object',
                    'oneOf' => [
                        [
                            'description' => str_repeat('Long variant description ', 12),
                            'properties' => [
                                'value' => ['type' => 'integer'],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $variant = app(ProcessSchemaNormalizer::class)
        ->normalize($process)['fields']['mode']['variants'][0];

    expect($variant['label'])->toBe('Variant')
        ->and($variant['label'])->not->toContain('1')
        ->and($variant['description'])->toStartWith('Long variant description');
});

test('it uses a short one of description when no title is available', function () {
    $process = [
        'id' => 'short-description',
        'inputs' => [
            'mode' => [
                'schema' => [
                    'oneOf' => [
                        [
                            'description' => 'Pressure sweep',
                            'properties' => [],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $variant = app(ProcessSchemaNormalizer::class)
        ->normalize($process)['fields']['mode']['variants'][0];

    expect($variant['label'])->toBe('Pressure sweep');
});
```

Add this assertion to the existing array-table test:

```php
expect(array_column($field['columns'], 'required'))
    ->toBe(array_fill(0, 14, true));
```

- [ ] **Step 2: Run the normalizer test and verify RED**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
```

Expected: FAIL because the fallback is Variant 1 and columns do not contain required.

- [ ] **Step 3: Implement index-free labels**

In normalizeField, call variantLabel without the index:

```php
'variants' => collect($schema['oneOf'])
    ->values()
    ->map(fn (array $variant, int $index): array => [
        'id' => (string) $index,
        'label' => $this->variantLabel($variant),
        'description' => $variant['description'] ?? null,
        'required' => $variant['required'] ?? [],
        'fields' => $this->normalizeProperties(
            $variant['properties'] ?? [],
            $variant['required'] ?? [],
        ),
    ])
    ->all(),
```

Replace variantLabel with:

```php
/**
 * @param  array<string, mixed>  $variant
 */
private function variantLabel(array $variant): string
{
    $title = $variant['title'] ?? null;

    if (is_string($title) && trim($title) !== '') {
        return trim($title);
    }

    $description = $variant['description'] ?? null;

    if (
        is_string($description)
        && trim($description) !== ''
        && mb_strlen(trim($description)) <= 80
    ) {
        return trim($description);
    }

    $constantLabels = collect($variant['properties'] ?? [])
        ->map(function (array $schema, string $name): ?string {
            $value = $schema['const'] ?? null;

            if (
                ! array_key_exists('const', $schema)
                && isset($schema['enum'])
                && is_array($schema['enum'])
                && count($schema['enum']) === 1
            ) {
                $value = $schema['enum'][0];
            }

            if ($value === null) {
                return null;
            }

            return $name.' = '.$this->formatVariantConstant($value);
        })
        ->filter()
        ->values();

    if ($constantLabels->isNotEmpty()) {
        return $constantLabels->implode(', ');
    }

    $requiredLabels = collect($variant['required'] ?? [])
        ->map(function (string $name) use ($variant): string {
            $title = data_get($variant, "properties.{$name}.title");

            return is_string($title) && trim($title) !== ''
                ? trim($title)
                : $name;
        })
        ->values();

    return $requiredLabels->isNotEmpty()
        ? $requiredLabels->implode(', ')
        : 'Variant';
}
```

- [ ] **Step 4: Normalize required tuple positions**

Inside normalizeArrayField, calculate the required column count immediately after columnCount:

```php
$columnCount = (int) ($items['maxItems'] ?? $items['minItems'] ?? 1);
$requiredColumnCount = max(0, (int) ($items['minItems'] ?? 0));
```

Add required to every normalized column:

```php
'required' => $column <= $requiredColumnCount,
```

Add the corresponding TypeScript property:

```typescript
columns?: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    pattern?: string | null;
    minimum?: number | null;
    maximum?: number | null;
    exclusiveMinimum?: number | null;
    exclusiveMaximum?: number | null;
}[];
```

- [ ] **Step 5: Format and run the focused test**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
bun run types:check
```

Expected: all commands pass.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add app/Services/Ogc/ProcessSchemaNormalizer.php resources/js/types/ogc.ts tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
git commit -m "fix: normalize OGC variant labels and table requirements"
```

## Task 2: Validate the Explicit Variant and Build a Canonical OGC Payload

**Files:**

- Create: app/Services/Ogc/ProcessInputPayloadBuilder.php
- Create: tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
- Modify: app/Services/Ogc/ProcessInputValidator.php:42-288
- Modify: app/Http/Controllers/Ogc/ProcessExecutionController.php:51-103
- Modify: tests/Unit/Ogc/ProcessInputValidatorTest.php
- Modify: tests/Feature/Ogc/ProcessExecutionTest.php

- [ ] **Step 1: Scaffold the payload builder and its Pest test**

Run:

```bash
php artisan make:class Services/Ogc/ProcessInputPayloadBuilder --no-interaction
php artisan make:test --pest --unit ProcessInputPayloadBuilderTest --no-interaction
mv tests/Unit/ProcessInputPayloadBuilderTest.php tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
```

Expected: the class and test exist in the paths listed above.

- [ ] **Step 2: Write failing validator tests**

Update existing object-bound assertions to include the OGC value segment:

```php
expect($tooLow)->toHaveKey('inputs.melt_composition.value.sio2')
    ->and($tooHigh)->toHaveKey('inputs.melt_composition.value.sio2');
```

Append:

```php
test('it validates only the explicitly selected one of variant', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'variant' => '1',
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                ],
            ],
        ],
    );

    expect($errors)
        ->toHaveKey('inputs.swinput.data.value.iopen')
        ->not->toHaveKey('inputs.swinput.data.value.ndat2');
});

test('it rejects unknown one of variant identifiers at the selector path', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'variant' => '99',
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                    'iopen' => 0,
                ],
            ],
        ],
    );

    expect($errors)->toHaveKey('inputs.swinput.data.variant');
});

test('it accepts legacy one of input only when one complete variant matches', function () {
    $fields = normalizedOgcFields('process-solwcad');
    $unique = app(ProcessInputValidator::class)->errors($fields, [
        'swinput.data' => [
            'value' => [
                'ndat1' => 1,
                'kl' => 1,
                'iopen' => 0,
            ],
        ],
    ]);
    $ambiguous = app(ProcessInputValidator::class)->errors($fields, [
        'swinput.data' => [
            'value' => [
                'ndat1' => 1,
                'ndat2' => 1,
                'kl' => 0,
            ],
        ],
    ]);

    expect($unique)->not->toHaveKey('inputs.swinput.data')
        ->and($ambiguous)->toHaveKey('inputs.swinput.data');
});

test('it rejects blank required array table cells', function () {
    $fields = normalizedOgcFields('process-solwcad');
    $row = array_fill(0, 14, null);

    $errors = app(ProcessInputValidator::class)->errors($fields, [
        'sw.data' => [$row],
    ]);

    expect($errors)->toHaveKey('inputs.sw.data.0.0');
});
```

- [ ] **Step 3: Write failing payload-builder tests**

Replace the generated test with:

```php
<?php

use App\Services\Ogc\ProcessInputPayloadBuilder;
use Tests\TestCase;

uses(TestCase::class);

test('it removes only the selected variant marker from one of inputs', function () {
    $fields = [
        'swinput.data' => [
            'kind' => 'oneOf',
        ],
    ];

    $inputs = [
        'swinput.data' => [
            'variant' => '1',
            'value' => [
                'ndat1' => 1,
                'kl' => 1,
                'iopen' => 0,
            ],
        ],
    ];

    expect(app(ProcessInputPayloadBuilder::class)->build($fields, $inputs))
        ->toBe([
            'swinput.data' => [
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                    'iopen' => 0,
                ],
            ],
        ]);
});

test('it preserves non one of OGC input representations', function () {
    $fields = [
        'sw.data' => [
            'kind' => 'array_table',
        ],
        'dataset' => [
            'kind' => 'scalar',
        ],
    ];

    $inputs = [
        'sw.data' => [['1000.', '1273.']],
        'dataset' => [
            'href' => 'https://example.test/data.csv',
            'type' => 'text/csv',
        ],
    ];

    expect(app(ProcessInputPayloadBuilder::class)->build($fields, $inputs))
        ->toBe($inputs);
});
```

- [ ] **Step 4: Write failing controller feature tests**

Append to ProcessExecutionTest.php:

```php
test('starting solwcad returns the selected variant field error without queueing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $row = [
        '1000.',
        '1273.',
        '.0400',
        '.0200',
        '.7653',
        '.0032',
        '.1201',
        '.0027',
        '.0246',
        '.0006',
        '.0018',
        '.0132',
        '.0378',
        '.0306',
    ];

    $response = $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => [
                'swinput.data' => [
                    'variant' => '1',
                    'value' => [
                        'ndat1' => 1,
                        'kl' => 1,
                    ],
                ],
                'sw.data' => [$row],
            ],
        ],
    );

    $response
        ->assertInvalid(['inputs.swinput.data.value.iopen'])
        ->assertValid(['inputs.swinput.data.value.ndat2']);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});

test('starting solwcad strips variant metadata from the stored and queued payload', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $row = [
        '1000.',
        '1273.',
        '.0400',
        '.0200',
        '.7653',
        '.0032',
        '.1201',
        '.0027',
        '.0246',
        '.0006',
        '.0018',
        '.0132',
        '.0378',
        '.0306',
    ];
    $selectedValue = [
        'ndat1' => 1,
        'kl' => 1,
        'iopen' => 0,
    ];

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => [
                'swinput.data' => [
                    'variant' => '1',
                    'value' => $selectedValue,
                ],
                'sw.data' => [$row],
            ],
        ],
    )->assertRedirect();

    $execution = ProcessExecution::query()->sole();

    expect($execution->request_payload['inputs']['swinput.data'])
        ->toBe(['value' => $selectedValue]);

    Bus::assertDispatched(
        SubmitProcessExecutionJob::class,
        fn (SubmitProcessExecutionJob $job): bool =>
            $job->payload['inputs']['swinput.data'] === ['value' => $selectedValue]
            && ! array_key_exists(
                'variant',
                $job->payload['inputs']['swinput.data'],
            ),
    );
    Http::assertNothingSent();
});
```

- [ ] **Step 5: Run the new tests and verify RED**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessInputValidatorTest.php tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=solwcad
```

Expected: failures show the old inferred variant, old paths without value, skipped blank cells, and the missing builder method.

- [ ] **Step 6: Implement ProcessInputPayloadBuilder**

Replace the scaffolded class with:

```php
<?php

namespace App\Services\Ogc;

class ProcessInputPayloadBuilder
{
    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    public function build(array $fields, array $inputs): array
    {
        $payload = [];

        foreach ($inputs as $name => $value) {
            $field = $fields[$name] ?? null;

            if (
                is_array($field)
                && ($field['kind'] ?? null) === 'oneOf'
                && is_array($value)
                && array_key_exists('value', $value)
            ) {
                $payload[$name] = [
                    'value' => $value['value'],
                ];

                continue;
            }

            $payload[$name] = $value;
        }

        return $payload;
    }
}
```

- [ ] **Step 7: Replace inferred oneOf validation with explicit selection**

In ProcessInputValidator.php, replace the object and oneOf dispatch entries with:

```php
'object' => $this->validateWrappedObject(
    $field,
    $value,
    $path,
    $errors,
),
'oneOf' => $this->validateOneOf(
    $field,
    $value,
    $path,
    $errors,
),
```

Add this wrapped-object method:

```php
/**
 * @param  array<string, mixed>  $field
 * @param  array<string, string>  $errors
 */
private function validateWrappedObject(
    array $field,
    mixed $value,
    string $path,
    array &$errors,
): void {
    if (is_array($value) && array_key_exists('value', $value)) {
        $this->validateObject(
            $field,
            $value['value'],
            $path.'.value',
            $errors,
        );

        return;
    }

    $this->validateObject($field, $value, $path, $errors);
}
```

Replace validateOneOf and matchingVariant with:

```php
/**
 * @param  array<string, mixed>  $field
 * @param  array<string, string>  $errors
 */
private function validateOneOf(
    array $field,
    mixed $value,
    string $path,
    array &$errors,
): void {
    if (! is_array($value)) {
        $errors[$path] = __('This input must be an object.');

        return;
    }

    $hasWrappedValue = array_key_exists('value', $value);
    $objectValue = $hasWrappedValue ? $value['value'] : $value;
    $objectPath = $hasWrappedValue ? $path.'.value' : $path;

    if (! is_array($objectValue)) {
        $errors[$objectPath] = __('This input must be an object.');

        return;
    }

    if (array_key_exists('variant', $value)) {
        $variantId = $value['variant'];

        if (! is_string($variantId) && ! is_int($variantId)) {
            $errors[$path.'.variant'] = __(
                'This input does not match an available option.',
            );

            return;
        }

        $variant = collect($field['variants'] ?? [])
            ->first(
                fn (mixed $candidate): bool =>
                    is_array($candidate)
                    && (string) ($candidate['id'] ?? '') === (string) $variantId,
            );

        if (! is_array($variant)) {
            $errors[$path.'.variant'] = __(
                'This input does not match an available option.',
            );

            return;
        }
    } else {
        $variant = $this->matchingVariant($field, $objectValue);

        if ($variant === null) {
            $errors[$path] = __(
                'This input does not match an available option.',
            );

            return;
        }
    }

    $this->validateObject(
        ['fields' => $variant['fields'] ?? []],
        $objectValue,
        $objectPath,
        $errors,
    );
}

/**
 * @param  array<string, mixed>  $field
 * @param  array<string, mixed>  $value
 * @return array<string, mixed>|null
 */
private function matchingVariant(array $field, array $value): ?array
{
    $matches = collect($field['variants'] ?? [])
        ->filter(function (mixed $variant) use ($value): bool {
            if (! is_array($variant)) {
                return false;
            }

            $required = array_filter(
                $variant['required'] ?? [],
                'is_string',
            );

            return collect($required)->every(
                fn (string $key): bool =>
                    array_key_exists($key, $value)
                    && ! $this->isBlank($value[$key]),
            );
        })
        ->values();

    return $matches->count() === 1 && is_array($matches->first())
        ? $matches->first()
        : null;
}
```

Delete unwrapValue after no callers remain.

- [ ] **Step 8: Reject blank required table cells**

Inside validateArrayTable, replace the scalar call with:

```php
$cellPath = "{$path}.{$rowIndex}.{$columnIndex}";
$cellValue = $row[$columnIndex] ?? null;

if (
    ($column['required'] ?? false) === true
    && $this->isBlank($cellValue)
) {
    $errors[$cellPath] = __('This input is required.');

    continue;
}

$this->validateScalar(
    $column,
    $cellValue,
    $cellPath,
    $errors,
);
```

- [ ] **Step 9: Build canonical inputs in the controller**

Import ProcessInputPayloadBuilder, inject it after ProcessInputValidator, and replace the validation/payload block with:

```php
$fields = $schemaNormalizer->normalize($processDescription)['fields'];
$submittedInputs = $request->executionInputs();
$inputErrors = $inputValidator->errors($fields, $submittedInputs);

if ($inputErrors !== []) {
    throw ValidationException::withMessages($inputErrors);
}

$executionInputs = $inputPayloadBuilder->build(
    $fields,
    $submittedInputs,
);

$payload = [
    'inputs' => $executionInputs,
    'outputs' => $outputRequestBuilder->forProcess(
        $processDescription,
        $request->outputSelection(),
    ),
];
```

- [ ] **Step 10: Format and verify Task 2**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Unit/Ogc/ProcessInputValidatorTest.php tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php
```

Expected: explicit-variant, blank-table, canonical-payload, and existing process tests pass.

- [ ] **Step 11: Commit Task 2**

Run:

```bash
git add app/Services/Ogc/ProcessInputPayloadBuilder.php app/Services/Ogc/ProcessInputValidator.php app/Http/Controllers/Ogc/ProcessExecutionController.php tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php tests/Unit/Ogc/ProcessInputValidatorTest.php tests/Feature/Ogc/ProcessExecutionTest.php
git commit -m "fix: validate selected OGC input variants"
```

## Task 3: Preserve Variant State and Correct Dropdown Defaults and Labels

**Files:**

- Create: resources/js/lib/ogc-form-values.ts
- Create: tests/Frontend/ogc-form-values.test.ts
- Modify: resources/js/components/ogc/dynamic-process-form.tsx:1-390
- Modify: resources/js/components/ogc/one-of-field.tsx:1-137
- Modify: resources/js/lib/ogc-fields.ts:15-21
- Modify: tests/Frontend/ogc-fields.test.ts:24-30

- [ ] **Step 1: Write the failing form-value tests**

Create tests/Frontend/ogc-form-values.test.ts:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
    defaultObjectValue,
    exampleInputsToFormValues,
    initialInputValues,
    normalizeInputs,
} from '../../resources/js/lib/ogc-form-values';
import type { OgcNormalizedField } from '../../resources/js/types';

const singletonVariant: OgcNormalizedField = {
    name: 'swinput.data',
    title: 'Desired computation',
    kind: 'oneOf',
    variants: [
        {
            id: '1',
            label: 'Pressure sweep',
            description: 'Compute from pressure to atmosphere.',
            required: ['ndat1', 'kl', 'iopen'],
            fields: {
                ndat1: {
                    name: 'ndat1',
                    title: 'ndat1',
                    kind: 'scalar',
                    type: 'integer',
                    required: true,
                },
                kl: {
                    name: 'kl',
                    title: 'kl',
                    kind: 'enum',
                    options: [1],
                    required: true,
                },
                iopen: {
                    name: 'iopen',
                    title: 'iopen',
                    kind: 'enum',
                    options: [0, 1],
                    required: true,
                },
            },
        },
    ],
};

describe('OGC form values', () => {
    test('initializes the only enum value inside the selected variant', () => {
        expect(initialInputValues({
            'swinput.data': singletonVariant,
        })).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    kl: 1,
                },
            },
        });
    });

    test('merges singleton defaults into example values', () => {
        expect(exampleInputsToFormValues(
            {
                'swinput.data': singletonVariant,
            },
            {
                'swinput.data': {
                    value: {
                        ndat1: 1,
                    },
                },
            },
        )).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    ndat1: 1,
                    kl: 1,
                },
            },
        });
    });

    test('keeps variant metadata until backend validation', () => {
        expect(normalizeInputs(
            {
                'swinput.data': singletonVariant,
            },
            {
                'swinput.data': {
                    variant: '1',
                    value: {
                        ndat1: 1,
                        kl: 1,
                        iopen: 0,
                    },
                },
            },
        )).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    ndat1: 1,
                    kl: 1,
                    iopen: 0,
                },
            },
        });
    });

    test('builds singleton defaults directly for variant changes', () => {
        const variant = singletonVariant.variants?.[0];

        expect(defaultObjectValue(variant?.fields ?? {})).toEqual({
            kl: 1,
        });
    });

    test('renders the selector before its description without an id prefix', () => {
        const source = readFileSync(
            'resources/js/components/ogc/one-of-field.tsx',
            'utf8',
        );

        expect(source.indexOf('<Select')).toBeLessThan(
            source.indexOf('selected.description'),
        );
        expect(source).toContain('{variant.label}');
        expect(source).not.toContain('{variant.id}: {variant.label}');
    });
});
```

Update the option-label test in ogc-fields.test.ts:

```typescript
test('shows enum options once', () => {
    expect(optionDisplayLabel('conduit')).toBe('conduit');
    expect(optionDisplayLabel(1)).toBe('1');
    expect(optionDisplayLabel(true)).toBe('true');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun test tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-fields.test.ts
```

Expected: FAIL because ogc-form-values.ts is missing and option labels are duplicated.

- [ ] **Step 3: Create the pure form-value module**

Create resources/js/lib/ogc-form-values.ts with:

```typescript
import type { OgcNormalizedField } from '@/types';

export type OneOfValue = {
    variant: string;
    value: Record<string, unknown>;
};

export function exampleInputsToFormValues(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs)
            .filter(([name]) => Boolean(fields[name]))
            .map(([name, value]) => [
                name,
                exampleInputToFormValue(fields[name], value),
            ]),
    );
}

export function initialInputValues(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter((entry) => entry[1] !== undefined),
    );
}

export function defaultObjectValue(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter((entry) => entry[1] !== undefined),
    );
}

export function normalizeInputs(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs).map(([name, value]) => [
            name,
            normalizeValue(value, fields[name]),
        ]),
    );
}

export function isOneOfValue(value: unknown): value is OneOfValue {
    return (
        isRecord(value) &&
        typeof value.variant === 'string' &&
        isRecord(value.value)
    );
}

function exampleInputToFormValue(
    field: OgcNormalizedField,
    input: unknown,
): unknown {
    const value = unwrapExampleValue(input);

    if (field.kind === 'oneOf') {
        const objectValue = isRecord(value) ? value : {};
        const variant =
            field.variants?.find((candidate) =>
                Object.keys(objectValue).some((key) =>
                    Object.prototype.hasOwnProperty.call(
                        candidate.fields,
                        key,
                    ),
                ),
            ) ?? field.variants?.[0];

        if (!variant) {
            return value;
        }

        return {
            variant: variant.id,
            value: {
                ...defaultObjectValue(variant.fields),
                ...objectValue,
            },
        };
    }

    if (field.kind === 'object') {
        return isRecord(value) ? value : {};
    }

    return value;
}

function unwrapExampleValue(value: unknown): unknown {
    if (
        isRecord(value)
        && Object.prototype.hasOwnProperty.call(value, 'value')
    ) {
        return value.value;
    }

    return value;
}

function defaultFieldValue(field: OgcNormalizedField): unknown {
    if (field.kind === 'enum' && field.options?.length === 1) {
        return field.options[0];
    }

    if (field.kind === 'oneOf') {
        const variant = field.variants?.[0];

        if (!variant) {
            return undefined;
        }

        return {
            variant: variant.id,
            value: defaultObjectValue(variant.fields),
        };
    }

    if (field.kind === 'object' && field.fields) {
        const value = defaultObjectValue(field.fields);

        return Object.keys(value).length > 0 ? value : undefined;
    }

    if (field.kind === 'array_table' && Number(field.minItems) > 0) {
        return Array.from(
            { length: Number(field.minItems) },
            () => (field.columns ?? []).map(() => ''),
        );
    }

    if (field.kind === 'array_object' && Number(field.minItems) > 0) {
        return Array.from(
            { length: Number(field.minItems) },
            () => defaultObjectValue(field.fields ?? {}),
        );
    }

    return undefined;
}

function normalizeValue(
    value: unknown,
    field?: OgcNormalizedField,
): unknown {
    if (isOneOfValue(value)) {
        return {
            variant: value.variant,
            value: toFormValue(value.value),
        };
    }

    if (field?.kind === 'object') {
        return {
            value: toFormValue(value),
        };
    }

    return toFormValue(value);
}

function toFormValue(value: unknown): unknown {
    if (
        value === null
        || value === undefined
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => toFormValue(item));
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                toFormValue(item),
            ]),
        );
    }

    return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value);
}
```

- [ ] **Step 4: Wire the extracted helpers into the form**

In dynamic-process-form.tsx import:

```typescript
import {
    exampleInputsToFormValues,
    initialInputValues,
    normalizeInputs,
} from '@/lib/ogc-form-values';
```

Delete the local helper definitions from exampleInputsToFormValues through isRecord. Keep the existing form call sites unchanged except that normalizeInputs now retains variant.

In one-of-field.tsx import:

```typescript
import {
    defaultObjectValue,
    isOneOfValue,
} from '@/lib/ogc-form-values';
```

Delete the local OneOfValue, isOneOfValue, defaultObjectValue, and defaultFieldValue definitions.

Move the Select block above the selected.description block. Render each option exactly as:

```tsx
<SelectItem key={variant.id} value={variant.id}>
    {variant.label}
</SelectItem>
```

- [ ] **Step 5: Render enum option values once**

Replace optionDisplayLabel with:

```typescript
export function optionDisplayLabel(
    option: string | number | boolean,
): string {
    return String(option);
}
```

- [ ] **Step 6: Run frontend verification**

Run:

```bash
bun test tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-fields.test.ts
bun run types:check
bun run lint:check
```

Expected: tests, typecheck, and lint pass.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add resources/js/lib/ogc-form-values.ts resources/js/components/ogc/dynamic-process-form.tsx resources/js/components/ogc/one-of-field.tsx resources/js/lib/ogc-fields.ts tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-fields.test.ts
git commit -m "fix: preserve OGC variant form state"
```

## Task 4: Render Inline Errors and Focus the First Invalid Control

**Files:**

- Create: resources/js/lib/ogc-form-errors.ts
- Create: tests/Frontend/ogc-form-errors.test.ts
- Modify: resources/js/components/ogc/dynamic-process-form.tsx
- Modify: resources/js/components/ogc/schema-field-renderer.tsx
- Modify: resources/js/components/ogc/one-of-field.tsx
- Modify: resources/js/components/ogc/array-table-field.tsx
- Modify: resources/js/components/ogc/array-object-field.tsx
- Modify: resources/js/components/ogc/data-input-field.tsx
- Modify: resources/js/components/ogc/section-field-set.tsx
- Modify: tests/Frontend/html-pattern.test.ts

- [ ] **Step 1: Write the failing error-routing tests**

Create tests/Frontend/ogc-form-errors.test.ts:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
    errorIdForPath,
    fieldError,
    firstInvalidFieldPath,
} from '../../resources/js/lib/ogc-form-errors';

describe('OGC form errors', () => {
    test('reads exact dotted Inertia errors', () => {
        const errors = {
            'inputs.swinput.data.value.iopen': 'This input is required.',
        };

        expect(fieldError(
            errors,
            'inputs.swinput.data.value.iopen',
        )).toBe('This input is required.');
        expect(errorIdForPath(
            'inputs.swinput.data.value.iopen',
        )).toBe('error-inputs-swinput-data-value-iopen');
    });

    test('prefers an exact child control over an earlier parent container', () => {
        const controls = [
            'inputs.swinput.data',
            'inputs.swinput.data.variant',
            'inputs.swinput.data.value.ndat1',
            'inputs.swinput.data.value.iopen',
        ];
        const errors = {
            'inputs.swinput.data.value.iopen': 'This input is required.',
        };

        expect(firstInvalidFieldPath(controls, errors))
            .toBe('inputs.swinput.data.value.iopen');
    });

    test('falls back to the closest structural control', () => {
        const controls = [
            'inputs.sw.data',
            'inputs.sw.data.0.0',
        ];
        const errors = {
            'inputs.sw.data.0': 'This row must be an array.',
        };

        expect(firstInvalidFieldPath(controls, errors))
            .toBe('inputs.sw.data');
    });

    test('wires failed submit focus and field accessibility', () => {
        const form = readFileSync(
            'resources/js/components/ogc/dynamic-process-form.tsx',
            'utf8',
        );
        const renderer = readFileSync(
            'resources/js/components/ogc/schema-field-renderer.tsx',
            'utf8',
        );
        const table = readFileSync(
            'resources/js/components/ogc/array-table-field.tsx',
            'utf8',
        );

        expect(form).toContain('onError:');
        expect(form).toContain('focusFirstInvalidField');
        expect(renderer).toContain('data-field-path');
        expect(renderer).toContain('aria-invalid');
        expect(table).toContain('required={column.required}');
        expect(table).toContain('InputError');
    });
});
```

Extend html-pattern.test.ts with Francesco's proposed forms:

```typescript
test('requires an escaped hyphen for browser v flag character classes', () => {
    expect(htmlPatternForInput({
        type: 'string',
        pattern:
            '^[+-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+-]?[0-9]+)?$',
    })).toBeUndefined();

    expect(htmlPatternForInput({
        type: 'string',
        pattern:
            '^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$',
    })).toBe(
        '^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$',
    );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun test tests/Frontend/ogc-form-errors.test.ts tests/Frontend/html-pattern.test.ts
```

Expected: FAIL because the error helper and component wiring do not exist. The escaped pattern test should document the current helper behavior without requiring a regex converter.

- [ ] **Step 3: Implement the pure error helper**

Create resources/js/lib/ogc-form-errors.ts:

```typescript
export type OgcFormErrors = Record<string, string | undefined>;

export function fieldError(
    errors: OgcFormErrors,
    path: string,
): string | undefined {
    return errors[path];
}

export function errorIdForPath(path: string): string {
    return 'error-' + path.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
}

export function firstInvalidFieldPath(
    controlPaths: string[],
    errors: OgcFormErrors,
): string | null {
    const errorPaths = Object.entries(errors)
        .filter((entry): entry is [string, string] =>
            typeof entry[1] === 'string' && entry[1].length > 0,
        )
        .map(([path]) => path);

    const exact = controlPaths.find((path) =>
        errorPaths.includes(path),
    );

    if (exact) {
        return exact;
    }

    return controlPaths.find((path) =>
        errorPaths.some((errorPath) =>
            errorPath.startsWith(path + '.'),
        ),
    ) ?? null;
}

export function focusFirstInvalidField(
    form: HTMLFormElement | null,
    errors: OgcFormErrors,
): boolean {
    if (!form) {
        return false;
    }

    const controls = Array.from(
        form.querySelectorAll<HTMLElement>('[data-field-path]'),
    );
    const path = firstInvalidFieldPath(
        controls
            .map((control) => control.dataset.fieldPath)
            .filter((value): value is string => Boolean(value)),
        errors,
    );
    const target = controls.find(
        (control) => control.dataset.fieldPath === path,
    );

    if (!target) {
        return false;
    }

    target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    });
    target.focus({
        preventScroll: true,
    });

    return true;
}
```

- [ ] **Step 4: Make structural fields focusable and accessible**

Replace section-field-set.tsx with:

```tsx
import type { ReactNode } from 'react';

import InputError from '@/components/input-error';
import {
    FieldDescription,
    FieldLegend,
    FieldSet,
} from '@/components/ui/field';
import { errorIdForPath } from '@/lib/ogc-form-errors';
import { cn } from '@/lib/utils';

export default function SectionFieldSet({
    label,
    description,
    children,
    className,
    fieldPath,
    error,
}: {
    label: string;
    description?: string | null;
    children: ReactNode;
    className?: string;
    fieldPath?: string;
    error?: string;
}) {
    const errorId = fieldPath ? errorIdForPath(fieldPath) : undefined;

    return (
        <FieldSet
            className={cn(
                'max-w-full min-w-0 gap-4 rounded-md border bg-muted/30 p-4 shadow-xs dark:border-border/70 dark:bg-muted/20',
                className,
            )}
            data-field-path={fieldPath}
            tabIndex={fieldPath ? -1 : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
        >
            <FieldLegend className="mb-1 w-fit px-1 text-sm">
                {label}
            </FieldLegend>
            {description ? (
                <FieldDescription className="break-words">
                    {description}
                </FieldDescription>
            ) : null}
            <InputError id={errorId} message={error} />
            {children}
        </FieldSet>
    );
}
```

- [ ] **Step 5: Thread path and errors through SchemaFieldRenderer**

Change its props to:

```typescript
{
    field,
    value,
    onChange,
    path,
    errors,
    topLevel = false,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    errors: OgcFormErrors;
    topLevel?: boolean;
}
```

For object children, use:

```tsx
const objectValue = isRecord(value) ? value : {};
const objectPath = topLevel ? path + '.value' : path;
const error = fieldError(errors, path);

return (
    <SectionFieldSet
        label={fieldDisplayLabel(field)}
        description={field.description}
        fieldPath={path}
        error={error}
    >
        <FieldGroup className="min-w-0">
            {Object.entries(field.fields).map(([key, child]) => (
                <SchemaFieldRenderer
                    key={key}
                    field={child}
                    value={objectValue[key]}
                    onChange={(nextValue) =>
                        onChange({
                            ...objectValue,
                            [key]: nextValue,
                        })
                    }
                    path={objectPath + '.' + key}
                    errors={errors}
                />
            ))}
        </FieldGroup>
    </SectionFieldSet>
);
```

Forward path and errors to OneOfField, ArrayObjectField, ArrayTableField, and DataInputField. For enum and scalar leaves, calculate:

```typescript
const error = fieldError(errors, path);
const errorId = errorIdForPath(path);
```

Set data-invalid on Field, and set these attributes on SelectTrigger or Input:

```tsx
data-field-path={path}
aria-invalid={error ? true : undefined}
aria-describedby={error ? errorId : undefined}
```

Render this immediately after each control:

```tsx
<InputError id={errorId} message={error} />
```

- [ ] **Step 6: Wire oneOf selector and child paths**

Add path and errors props to OneOfField. Its fieldset uses fieldPath={path} and error={fieldError(errors, path)}. The SelectTrigger uses:

```tsx
data-field-path={path + '.variant'}
aria-invalid={
    fieldError(errors, path + '.variant') ? true : undefined
}
aria-describedby={
    fieldError(errors, path + '.variant')
        ? errorIdForPath(path + '.variant')
        : undefined
}
```

Render the selector error after Select:

```tsx
<InputError
    id={errorIdForPath(path + '.variant')}
    message={fieldError(errors, path + '.variant')}
/>
```

Every selected child receives:

```tsx
path={path + '.value.' + key}
errors={errors}
```

- [ ] **Step 7: Wire table, array-object, and data controls**

ArrayTableField receives path and errors. Its fieldset receives the structural path/error. Each cell calculates:

```typescript
const cellPath = path + '.' + rowIndex + '.' + columnIndex;
const error = fieldError(errors, cellPath);
const errorId = errorIdForPath(cellPath);
```

Its Input receives:

```tsx
required={column.required}
data-field-path={cellPath}
aria-invalid={error ? true : undefined}
aria-describedby={error ? errorId : undefined}
```

Render InputError in the same TableCell.

ArrayObjectField receives path and errors, marks its fieldset with the structural error, and passes this to each row child:

```tsx
path={path + '.' + index + '.' + key}
errors={errors}
```

DataInputField receives path and errors, puts data-field-path and aria attributes on the currently active Textarea, URL Input, SelectTrigger, or file Input, and renders one InputError after its FieldGroup.

- [ ] **Step 8: Focus after Inertia validation errors**

In dynamic-process-form.tsx import useRef plus the error helpers:

```typescript
import { useRef } from 'react';
import {
    focusFirstInvalidField,
    type OgcFormErrors,
} from '@/lib/ogc-form-errors';
```

Create:

```typescript
const formRef = useRef<HTMLFormElement>(null);
const fieldErrors = errors as OgcFormErrors;
```

Attach ref={formRef} to form. Pass each top-level renderer:

```tsx
path={'inputs.' + name}
errors={fieldErrors}
topLevel
```

Give the process-name Input data-field-path="name", aria-describedby="error-name" when invalid, and id="error-name" to its InputError.

Add the submit callback:

```typescript
onError: (nextErrors) => {
    window.requestAnimationFrame(() => {
        focusFirstInvalidField(
            formRef.current,
            nextErrors as OgcFormErrors,
        );
    });
},
```

Keep the existing onSuccess callback.

- [ ] **Step 9: Run Task 4 verification**

Run:

```bash
bun test tests/Frontend/ogc-form-errors.test.ts tests/Frontend/html-pattern.test.ts tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-fields.test.ts
bun run types:check
bun run lint:check
```

Expected: all frontend tests and static checks pass.

- [ ] **Step 10: Commit Task 4**

Run:

```bash
git add resources/js/lib/ogc-form-errors.ts resources/js/components/ogc/dynamic-process-form.tsx resources/js/components/ogc/schema-field-renderer.tsx resources/js/components/ogc/one-of-field.tsx resources/js/components/ogc/array-table-field.tsx resources/js/components/ogc/array-object-field.tsx resources/js/components/ogc/data-input-field.tsx resources/js/components/ogc/section-field-set.tsx tests/Frontend/ogc-form-errors.test.ts tests/Frontend/html-pattern.test.ts
git commit -m "fix: focus invalid OGC process fields"
```

## Task 5: Use Logical Output Metadata and Always Show Descriptions

**Files:**

- Modify: app/Http/Controllers/Ogc/ProcessExecutionController.php:106-163
- Modify: resources/js/types/ogc.ts:126-156
- Modify: resources/js/lib/ogc-result-groups.ts:1-123
- Modify: resources/js/pages/process-executions/show.tsx:56-80
- Modify: resources/js/components/ogc/result-preview.tsx:1-75
- Modify: tests/Feature/Ogc/ProcessExecutionResultTest.php
- Modify: tests/Frontend/ogc-outputs.test.ts

- [ ] **Step 1: Write the failing backend metadata test**

Append to ProcessExecutionResultTest.php:

```php
test('execution detail exposes logical process output metadata', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $execution = ProcessExecution::factory()->for($user)->create([
        'process_outputs' => $process['outputs'],
    ]);

    $response = $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    expect($response->inertiaProps('execution.outputMetadata.dem'))
        ->toBe([
            'title' => 'Primary DEM',
            'description' => 'The local DSM (GeoTIFF) used for the simulation.',
        ])
        ->and(
            $response->inertiaProps(
                'execution.outputMetadata.invasion_map.description',
            ),
        )->toBe($process['outputs']['invasion_map']['description']);
});
```

- [ ] **Step 2: Write failing frontend output tests**

Append to ogc-outputs.test.ts:

```typescript
test('prefers logical output title and description for map groups', () => {
    const groups = groupProcessResults(
        [
            result({
                id: 10,
                outputId: 'dem.geotiff',
                title: 'Primary DEM - GeoTIFF',
                description: 'GeoTIFF component description',
                mediaType: 'image/tiff; application=geotiff',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                title: 'Primary DEM - SLD',
                description: 'SLD component description',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ],
        {
            dem: {
                title: 'Primary DEM',
                description:
                    'The local DSM (GeoTIFF) used for the simulation.',
            },
        },
    );

    expect(groups[0]).toMatchObject({
        kind: 'geotiff-map',
        outputId: 'dem',
        title: 'Primary DEM',
        description:
            'The local DSM (GeoTIFF) used for the simulation.',
    });
});

test('keeps component metadata as a fallback for historical executions', () => {
    const groups = groupProcessResults([
        result({
            id: 10,
            outputId: 'dem.geotiff',
            title: 'Primary DEM - GeoTIFF',
            description: 'GeoTIFF component description',
            mediaType: 'image/tiff',
        }),
        result({
            id: 11,
            outputId: 'dem.sld',
            mediaType: 'application/vnd.ogc.sld+xml',
        }),
    ]);

    expect(groups[0]).toMatchObject({
        kind: 'geotiff-map',
        title: 'Primary DEM',
        description: 'GeoTIFF component description',
    });
});

test('renders every non empty result description even when it matches title', () => {
    const source = readFileSync(
        'resources/js/components/ogc/result-preview.tsx',
        'utf8',
    );

    expect(source).toContain(
        '<CardDescription>{result.description}</CardDescription>',
    );
    expect(source).not.toContain(
        'result.description !== result.title',
    );
});
```

Add this import at the top:

```typescript
import { readFileSync } from 'node:fs';
```

- [ ] **Step 3: Run metadata tests and verify RED**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="logical process output metadata"
bun test tests/Frontend/ogc-outputs.test.ts
```

Expected: FAIL because outputMetadata is missing, groupProcessResults accepts one argument, and ResultPreview omits CardDescription.

- [ ] **Step 4: Expose logical metadata from persisted process_outputs**

Add outputMetadata to the execution array, casting the empty historical case to a JSON object:

```php
'outputMetadata' => (object) $this->outputMetadata($processExecution),
```

Add this private controller method:

```php
/**
 * @return array<string, array{
 *     title: string,
 *     description: string|null
 * }>
 */
private function outputMetadata(
    ProcessExecution $processExecution,
): array {
    $metadata = [];

    foreach ($processExecution->process_outputs ?? [] as $outputId => $output) {
        if (! is_array($output)) {
            continue;
        }

        $title = $output['title'] ?? null;
        $description = $output['description'] ?? null;

        $metadata[(string) $outputId] = [
            'title' => is_string($title) && trim($title) !== ''
                ? $title
                : (string) $outputId,
            'description' => is_string($description)
                && trim($description) !== ''
                    ? $description
                    : null,
        ];
    }

    return $metadata;
}
```

- [ ] **Step 5: Type and consume logical metadata**

Add:

```typescript
export type ProcessOutputMetadata = Record<
    string,
    {
        title: string;
        description?: string | null;
    }
>;
```

Add outputMetadata: ProcessOutputMetadata to ProcessExecutionDetail.

Change groupProcessResults to accept a defaulted second argument:

```typescript
export function groupProcessResults(
    results: ProcessExecutionResult[],
    outputMetadata: ProcessOutputMetadata = {},
): ProcessResultVisualItem[] {
```

When pushing a GeoTIFF map group, use:

```typescript
const logicalMetadata = outputMetadata[match.outputId];
const logicalDescription = logicalMetadata?.description?.trim();

visualItems.push({
    kind: 'geotiff-map',
    outputId: match.outputId,
    title:
        logicalMetadata?.title?.trim()
        || groupedTitle(match.outputId, geotiff, sld),
    description:
        logicalDescription
        || geotiff.description
        || sld.description,
    geotiff,
    sld,
});
```

Import ProcessOutputMetadata in ogc-result-groups.ts.

Change the show page call to:

```typescript
const visualResults = groupProcessResults(
    execution.results,
    execution.outputMetadata,
);
```

- [ ] **Step 6: Render ResultPreview descriptions**

Import CardDescription and render beneath CardTitle:

```tsx
{result.description ? (
    <CardDescription>{result.description}</CardDescription>
) : null}
```

Do not compare the description to the title.

- [ ] **Step 7: Format and verify Task 5**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php
bun test tests/Frontend/ogc-outputs.test.ts
bun run types:check
bun run lint:check
```

Expected: logical dem/invasion_map metadata, historical fallback, and duplicate title/description behavior pass.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add app/Http/Controllers/Ogc/ProcessExecutionController.php resources/js/types/ogc.ts resources/js/lib/ogc-result-groups.ts resources/js/pages/process-executions/show.tsx resources/js/components/ogc/result-preview.tsx tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Frontend/ogc-outputs.test.ts
git commit -m "fix: show logical OGC output descriptions"
```

## Task 6: Hide SLD Diagnostics by Default Behind Configuration

**Files:**

- Modify: config/services.php:45-62
- Modify: .env.example
- Modify: app/Http/Controllers/Ogc/ProcessExecutionController.php:106-132
- Modify: tests/Feature/Ogc/ProcessExecutionResultTest.php:140-177

- [ ] **Step 1: Replace warning tests with explicit configuration cases**

Replace the existing admin warning test with:

```php
test('map layer warnings are disabled by default without running inspection', function () {
    Storage::fake('local');

    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($admin)->create();
    $geotiff = cachedHillshadeMapPair($execution);

    $this->mock(SldVisualizationInspector::class)
        ->shouldNotReceive('warningForResult');

    $response = $this->actingAs($admin)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    $results = collect(
        $response->inertiaProps('execution.results'),
    )->keyBy('id');

    expect(data_get($results->get($geotiff->id), 'mapLayer.warning'))
        ->toBeNull();
});

test('admin users can enable map layer warnings', function () {
    Storage::fake('local');
    config([
        'services.ogc_processes.show_map_layer_warnings' => true,
    ]);

    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($admin)->create();
    $geotiff = cachedHillshadeMapPair($execution);

    $response = $this->actingAs($admin)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    $results = collect(
        $response->inertiaProps('execution.results'),
    )->keyBy('id');

    expect(data_get($results->get($geotiff->id), 'mapLayer.warning'))
        ->toBe('hillshade_without_color_map');
});
```

Add this import:

```php
use App\Support\Ogc\SldVisualizationInspector;
```

Update the non-admin test to set the flag true before asserting null. This proves the existing admin restriction remains active.

- [ ] **Step 2: Run warning tests and verify RED**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="map layer warning"
```

Expected: the default-disabled mock fails because the inspector is currently called for every admin.

- [ ] **Step 3: Add env-backed configuration**

Add to config/services.php inside ogc_processes:

```php
'show_map_layer_warnings' => (bool) env(
    'OGC_PROCESSES_SHOW_MAP_LAYER_WARNINGS',
    false,
),
```

Add to .env.example:

```dotenv
OGC_PROCESSES_SHOW_MAP_LAYER_WARNINGS=false
```

- [ ] **Step 4: Gate backend analysis before invoking the inspector**

Replace the mapLayerWarnings assignment in show with:

```php
$showMapLayerWarnings = $includeAdminData
    && (bool) config(
        'services.ogc_processes.show_map_layer_warnings',
        false,
    );
$mapLayerWarnings = $showMapLayerWarnings
    ? $this->mapLayerWarnings(
        $processExecution,
        $findGeoTiffSldResultPairs,
        $sldVisualizationInspector,
    )
    : [];
```

Do not pass the env variable or a feature-flag prop to React. The existing result mapLayer.warning value remains the only frontend contract.

- [ ] **Step 5: Format and verify Task 6**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php
php artisan test --compact tests/Unit/Ogc/SldVisualizationInspectorTest.php
```

Expected: default disabled, enabled admin, enabled non-admin, and inspector unit tests pass.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add .env.example config/services.php app/Http/Controllers/Ogc/ProcessExecutionController.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "fix: gate OGC map style warnings"
```

## Task 7: Integrated Acceptance and Regression Verification

**Files:**

- Verify all files changed in Tasks 1-6.
- Modify only files required to fix a demonstrated verification failure.

- [ ] **Step 1: Ask TokenSave for affected tests**

Run tokensave_affected for the changed PHP and TypeScript source files with depth 5.

Expected: the recommended suite includes the focused OGC unit, feature, and frontend tests already listed. Add any newly reported direct tests to Step 3.

- [ ] **Step 2: Format the final diff**

Run:

```bash
vendor/bin/pint --dirty --format agent
bunx prettier --write resources/js/components/ogc resources/js/lib/ogc-form-errors.ts resources/js/lib/ogc-form-values.ts resources/js/lib/ogc-fields.ts resources/js/lib/ogc-result-groups.ts resources/js/pages/process-executions/show.tsx resources/js/types/ogc.ts tests/Frontend
git diff --check
```

Expected: formatters finish successfully and git diff --check prints no output.

- [ ] **Step 3: Run focused backend regression suites**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php tests/Unit/Ogc/ProcessInputValidatorTest.php tests/Unit/Ogc/ProcessInputPayloadBuilderTest.php
php artisan test --compact tests/Unit/Ogc/SldVisualizationInspectorTest.php tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: all focused Pest tests pass.

- [ ] **Step 4: Run the complete frontend test suite**

Run:

```bash
bun test tests/Frontend
```

Expected: all frontend tests pass, including form values, form errors, patterns, field labels, and output grouping.

- [ ] **Step 5: Run static and production-build checks**

Run:

```bash
bun run types:check
bun run lint:check
bun run format:check
bun run build
```

Expected: TypeScript, ESLint, Prettier, and Vite production build all pass.

- [ ] **Step 6: Verify the acceptance-specific assertions**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=solwcad
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="logical process output metadata|map layer warning"
bun test tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-form-errors.test.ts tests/Frontend/ogc-outputs.test.ts
```

Expected:

- selecting Solwcad variant 1 reports only the missing iopen field;
- successful submission strips variant and retains value;
- blank required sw.data cells fail;
- kl defaults to 1;
- dropdown labels contain no technical index and enum values appear once;
- dem and invasion_map use logical descriptions;
- normal output descriptions render even when equal to titles;
- SLD warnings are absent by default and available only to admins when enabled.

- [ ] **Step 7: Review the final diff for scope**

Run:

```bash
git status --short
git diff --stat HEAD~6
git log --oneline -8
```

Expected: no migrations, dependency files, routes, or unrelated refactors appear. The implementation consists of the six task commits plus any explicitly justified formatter fix.

- [ ] **Step 8: Commit verification-only fixes if needed**

If Step 2 changed formatting or a demonstrated failure required a fix, stage only those files and run:

```bash
git commit -m "chore: verify OGC process feedback fixes"
```

If no files changed, do not create an empty commit.

- [ ] **Step 9: Invoke completion verification**

Use superpowers:verification-before-completion, report the exact passing commands, and only then offer branch integration options through superpowers:finishing-a-development-branch.
