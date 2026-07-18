# OGC Process Output Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select one, many, or no top-level OGC process outputs and choose an advertised output format while preserving automatic transmission mode.

**Architecture:** Add one trusted backend format extractor shared by process-schema normalization and remote-request construction. The React form keeps selection state and submits only output identifiers plus format qualifiers; Laravel validates the shape, rebuilds the canonical output map from the cached process description, and the HTTP client serializes an empty map as a JSON object. Existing result handling remains unchanged except that an explicitly empty requested-output map produces no result requests or synthetic result records.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 3, React 19, TypeScript, Bun, Tailwind CSS 4, Laravel HTTP client.

---

## Design Reference

Implement the decisions in:

- docs/superpowers/specs/2026-07-16-ogc-process-output-selection-design.md

The non-negotiable semantics are:

- all top-level outputs start selected;
- the first advertised format starts selected;
- a single advertised format is still sent explicitly;
- selecting no outputs is valid and is sent remotely as outputs: {};
- omission of the outputs request field remains backward compatible and selects all outputs;
- transmissionMode is calculated by the backend and cannot be supplied by the browser;
- nested properties of an object output are not independently selectable;
- requested_outputs === [] means intentionally no outputs, while requested_outputs === null retains historical fallback behavior.

## File Structure

### Create

- app/Services/Ogc/ProcessOutputFormatExtractor.php
  - Extract ordered, deduplicated, trusted format choices from direct and composed output schemas.
- tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php
  - Unit coverage for direct formats, oneOf, anyOf, allOf, qualifiers, labels, and deduplication.
- tests/Unit/Ogc/OgcResultResponseParserTest.php
  - Unit coverage for explicit zero-output parsing and historical null behavior.
- resources/js/lib/process-output-selection.ts
  - Pure form-state initialization, updates, serialization, labels, keys, and error lookup.
- tests/Frontend/process-output-selection.test.ts
  - Bun tests for the pure output-selection state.
- resources/js/components/ogc/process-output-selector.tsx
  - Accessible checkbox and format-selection card.

### Modify

- app/Services/Ogc/ProcessSchemaNormalizer.php
  - Expose trusted formats on each normalized top-level output.
- app/Services/Ogc/ProcessOutputRequestBuilder.php
  - Apply a nullable selection, validate identifiers/formats, reconstruct trusted format qualifiers, and preserve automatic transmission mode.
- app/Http/Requests/Ogc/StoreProcessExecutionRequest.php
  - Validate the optional output-selection map and preserve the missing-versus-empty distinction.
- app/Http/Controllers/Ogc/ProcessExecutionController.php
  - Pass the validated selection to the request builder.
- app/Services/Ogc/OgcProcessesClient.php
  - Cast only the outbound outputs property to an object for JSON serialization.
- app/Services/Ogc/OgcResultResponseParser.php
  - Return no results for an explicitly empty requested-output map.
- app/Actions/Ogc/StoreProcessResult.php
  - Avoid result persistence and remote downloads for explicit zero-output executions.
- app/Actions/Ogc/PollProcessExecution.php
  - Finish successful zero-output jobs without calling the remote results endpoint.
- resources/js/types/ogc.ts
  - Add normalized output-format types.
- resources/js/components/ogc/dynamic-process-form.tsx
  - Own output state, render the selector, and transform it into the request map.
- resources/js/lib/i18n/messages.ts
  - Add Italian and English output-selection labels and messages.
- lang/it.json
  - Add backend validation translations.
- tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
  - Assert normalized real-world solwcad choices.
- tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php
  - Assert defaults, subsets, empty selections, exact formats, validation, and transmission modes.
- tests/Unit/Ogc/OgcProcessesClientTest.php
  - Assert exact empty-object JSON serialization.
- tests/Feature/Ogc/ProcessExecutionTest.php
  - Assert controller validation, canonical persistence, dispatch, compatibility, and synchronous zero-output behavior.
- tests/Feature/Ogc/PollProcessExecutionJobTest.php
  - Assert asynchronous zero-output completion without result retrieval.
- tests/Unit/ProcessUiLayoutTest.php
  - Replace the obsolete read-only-output assertions with selector wiring assertions.
- tests/Frontend/i18n.test.ts
  - Assert the new translation keys remain aligned.

### Delete

- resources/js/components/ogc/expected-outputs.tsx
  - Replaced by the interactive selector.

## Prerequisite

- [ ] **Step 1: Load the required implementation skills**

Use:

- superpowers:test-driven-development before production edits;
- inertia-react-development for DynamicProcessForm and the new React selector;
- tailwindcss-development for the selector styling;
- pest-testing for every PHP test edit;
- laravel-best-practices for PHP implementation;
- superpowers:verification-before-completion before claiming completion.

- [ ] **Step 2: Refresh version-specific framework guidance**

Before editing code, use Laravel Boost search-docs with:

    packages: ["laravel/framework", "inertiajs/inertia-laravel", "@inertiajs/react", "pestphp/pest"]
    queries: [
      "form request optional nested array allowed keys after validation",
      "request distinguish missing key from empty array",
      "useForm transform nested object errors"
    ]

Expected: confirm Laravel array-key allowlists, after-validation hooks, request-key presence checks, wildcard errors, and Inertia useForm transform behavior for the installed versions.

## Task 1: Extract Trusted Output Formats

**Files:**

- Create: app/Services/Ogc/ProcessOutputFormatExtractor.php
- Create: tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php

- [ ] **Step 1: Scaffold the class and test with Artisan**

Run:

    php artisan make:class Services/Ogc/ProcessOutputFormatExtractor --no-interaction
    php artisan make:test --pest --unit ProcessOutputFormatExtractorTest --no-interaction
    mkdir -p tests/Unit/Ogc
    mv tests/Unit/ProcessOutputFormatExtractorTest.php tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php

Expected: both files exist in the paths above. Do not create a new top-level directory.

- [ ] **Step 2: Write the failing extractor tests**

Replace tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php with:

    <?php

    use App\Services\Ogc\ProcessOutputFormatExtractor;
    use Tests\TestCase;

    uses(TestCase::class);

    test('it extracts direct output format qualifiers', function () {
        $formats = app(ProcessOutputFormatExtractor::class)->formats([
            'title' => 'GeoJSON document',
            'contentMediaType' => 'application/geo+json',
            'contentEncoding' => 'utf-8',
            'contentSchema' => 'https://example.test/schema/geojson.json',
        ]);

        expect($formats)->toBe([
            [
                'label' => 'GeoJSON document',
                'mediaType' => 'application/geo+json',
                'encoding' => 'utf-8',
                'schema' => 'https://example.test/schema/geojson.json',
            ],
        ]);
    });

    test('it preserves solwcad one of format order and labels', function () {
        $schema = ogcFixture('process-solwcad')['outputs']['solwcad_out']['schema'];

        expect(app(ProcessOutputFormatExtractor::class)->formats($schema))->toBe([
            [
                'label' => 'JSON Array',
                'mediaType' => 'application/json',
            ],
            [
                'label' => 'Plain text Array',
                'mediaType' => 'text/plain',
            ],
        ]);
    });

    test('it merges all of qualifiers and deduplicates equivalent any of choices', function () {
        $formats = app(ProcessOutputFormatExtractor::class)->formats([
            'allOf' => [
                ['contentEncoding' => 'utf-8'],
                [
                    'anyOf' => [
                        [
                            'title' => 'GeoJSON',
                            'contentMediaType' => 'application/geo+json',
                            'contentSchema' => ['required' => ['type'], 'type' => 'object'],
                        ],
                        [
                            'title' => 'Duplicate label is ignored',
                            'contentMediaType' => 'application/geo+json',
                            'contentSchema' => ['type' => 'object', 'required' => ['type']],
                        ],
                        [
                            'contentMediaType' => 'text/plain',
                            '$ref' => '#/$defs/plain',
                        ],
                    ],
                ],
            ],
        ]);

        expect($formats)->toBe([
            [
                'label' => 'GeoJSON',
                'mediaType' => 'application/geo+json',
                'encoding' => 'utf-8',
                'schema' => ['required' => ['type'], 'type' => 'object'],
            ],
            [
                'label' => 'text/plain',
                'mediaType' => 'text/plain',
                'encoding' => 'utf-8',
                'schema' => '#/$defs/plain',
            ],
        ]);
    });

    test('it ignores schema variants without a media type', function () {
        $formats = app(ProcessOutputFormatExtractor::class)->formats([
            'oneOf' => [
                ['title' => 'No format', 'type' => 'object'],
                ['title' => 'Text', 'contentMediaType' => 'text/plain'],
            ],
        ]);

        expect($formats)->toBe([
            [
                'label' => 'Text',
                'mediaType' => 'text/plain',
            ],
        ]);
    });

- [ ] **Step 3: Run the focused test and verify RED**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php

Expected: FAIL because ProcessOutputFormatExtractor has no formats method or implementation.

- [ ] **Step 4: Implement the extractor**

Replace app/Services/Ogc/ProcessOutputFormatExtractor.php with:

    <?php

    namespace App\Services\Ogc;

    class ProcessOutputFormatExtractor
    {
        /**
         * @param  array<string, mixed>  $schema
         * @return array<int, array{label: string, mediaType: string, encoding?: string, schema?: array<mixed>|string}>
         */
        public function formats(array $schema): array
        {
            $formats = [];
            $seen = [];

            foreach ($this->candidates($schema) as $candidate) {
                $mediaType = $candidate['mediaType'] ?? null;

                if (! is_string($mediaType) || trim($mediaType) === '') {
                    continue;
                }

                $mediaType = trim($mediaType);
                $label = $candidate['label'] ?? null;
                $format = [
                    'label' => is_string($label) && trim($label) !== '' ? trim($label) : $mediaType,
                    'mediaType' => $mediaType,
                ];
                $encoding = $candidate['encoding'] ?? null;

                if (is_string($encoding) && trim($encoding) !== '') {
                    $format['encoding'] = trim($encoding);
                }

                if (array_key_exists('schema', $candidate) && $this->isSchemaQualifier($candidate['schema'])) {
                    $format['schema'] = is_string($candidate['schema'])
                        ? trim($candidate['schema'])
                        : $candidate['schema'];
                }

                $key = $this->canonicalKey($format);

                if (isset($seen[$key])) {
                    continue;
                }

                $seen[$key] = true;
                $formats[] = $format;
            }

            return $formats;
        }

        /**
         * Remove display-only data before placing a trusted format in an OGC execution request.
         *
         * @param  array<string, mixed>  $format
         * @return array{mediaType: string, encoding?: string, schema?: array<mixed>|string}
         */
        public function requestFormat(array $format): array
        {
            $requestFormat = ['mediaType' => $format['mediaType']];

            foreach (['encoding', 'schema'] as $qualifier) {
                if (array_key_exists($qualifier, $format)) {
                    $requestFormat[$qualifier] = $format[$qualifier];
                }
            }

            return $requestFormat;
        }

        /**
         * @param  array<string, mixed>  $schema
         * @return array<int, array<string, mixed>>
         */
        private function candidates(array $schema): array
        {
            $candidates = [$this->qualifiers($schema)];

            foreach ($schema['allOf'] ?? [] as $subSchema) {
                if (! is_array($subSchema)) {
                    continue;
                }

                $candidates = $this->combine($candidates, $this->candidates($subSchema));
            }

            foreach (['oneOf', 'anyOf'] as $compositionKey) {
                $alternatives = [];

                foreach ($schema[$compositionKey] ?? [] as $subSchema) {
                    if (! is_array($subSchema)) {
                        continue;
                    }

                    array_push($alternatives, ...$this->candidates($subSchema));
                }

                if ($alternatives !== []) {
                    $candidates = $this->combine($candidates, $alternatives);
                }
            }

            return $candidates;
        }

        /**
         * @param  array<string, mixed>  $schema
         * @return array<string, mixed>
         */
        private function qualifiers(array $schema): array
        {
            $qualifiers = [];
            $title = $schema['title'] ?? null;
            $mediaType = $schema['contentMediaType'] ?? null;
            $encoding = $schema['contentEncoding'] ?? null;

            if (is_string($title) && trim($title) !== '') {
                $qualifiers['label'] = trim($title);
            }

            if (is_string($mediaType) && trim($mediaType) !== '') {
                $qualifiers['mediaType'] = trim($mediaType);
            }

            if (is_string($encoding) && trim($encoding) !== '') {
                $qualifiers['encoding'] = trim($encoding);
            }

            $contentSchema = $schema['contentSchema'] ?? null;
            $schemaReference = $schema['$ref'] ?? null;

            if ($this->isSchemaQualifier($contentSchema)) {
                $qualifiers['schema'] = $contentSchema;
            } elseif (is_string($schemaReference) && trim($schemaReference) !== '') {
                $qualifiers['schema'] = trim($schemaReference);
            }

            return $qualifiers;
        }

        /**
         * @param  array<int, array<string, mixed>>  $baseCandidates
         * @param  array<int, array<string, mixed>>  $variantCandidates
         * @return array<int, array<string, mixed>>
         */
        private function combine(array $baseCandidates, array $variantCandidates): array
        {
            $combined = [];

            foreach ($baseCandidates as $baseCandidate) {
                foreach ($variantCandidates as $variantCandidate) {
                    $combined[] = array_replace($baseCandidate, $variantCandidate);
                }
            }

            return $combined;
        }

        /**
         * @param  array<string, mixed>  $format
         */
        private function canonicalKey(array $format): string
        {
            $identity = array_intersect_key($format, array_flip(['mediaType', 'encoding', 'schema']));

            return json_encode($this->canonicalize($identity), JSON_THROW_ON_ERROR);
        }

        private function canonicalize(mixed $value): mixed
        {
            if (! is_array($value)) {
                return $value;
            }

            if (array_is_list($value)) {
                return array_map($this->canonicalize(...), $value);
            }

            $canonical = [];

            foreach ($value as $key => $item) {
                $canonical[$key] = $this->canonicalize($item);
            }

            ksort($canonical);

            return $canonical;
        }

        private function isSchemaQualifier(mixed $schema): bool
        {
            return is_array($schema) || (is_string($schema) && trim($schema) !== '');
        }
    }

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php

Expected: PASS, four tests.

- [ ] **Step 6: Format and commit**

Run:

    vendor/bin/pint --dirty --format agent
    git add app/Services/Ogc/ProcessOutputFormatExtractor.php tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php
    git commit -m "feat: extract OGC output formats"

## Task 2: Publish Formats In The Normalized Process Schema

**Files:**

- Modify: app/Services/Ogc/ProcessSchemaNormalizer.php
- Modify: resources/js/types/ogc.ts
- Modify: tests/Unit/Ogc/ProcessSchemaNormalizerTest.php

- [ ] **Step 1: Add a failing real-fixture normalization assertion**

In tests/Unit/Ogc/ProcessSchemaNormalizerTest.php, add this focused test:

    test('it normalizes ordered selectable output formats from solwcad', function () {
        $normalized = app(ProcessSchemaNormalizer::class)->normalize(
            ogcFixture('process-solwcad'),
        );

        expect($normalized['outputs']['solwcad_out']['formats'])->toBe([
            [
                'label' => 'JSON Array',
                'mediaType' => 'application/json',
            ],
            [
                'label' => 'Plain text Array',
                'mediaType' => 'text/plain',
            ],
        ])->and($normalized['outputs']['solwcad_out']['mediaType'])
            ->toBe('application/json');
    });

- [ ] **Step 2: Run the focused test and verify RED**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php --filter='normalizes ordered selectable output formats'

Expected: FAIL because formats is absent.

- [ ] **Step 3: Inject and use the shared extractor**

At the top of ProcessSchemaNormalizer, add the constructor:

    public function __construct(
        private ProcessOutputFormatExtractor $outputFormatExtractor,
    ) {}

Inside normalizeOutputs, ensure a non-array schema cannot reach typed methods:

    $schema = is_array($output['schema'] ?? null)
        ? $output['schema']
        : [];

Then add the authoritative formats key to each normalized output:

    'formats' => $this->outputFormatExtractor->formats($schema),

Keep mediaType, contentEncoding, schemaRef, schemaType, and components unchanged for result-display compatibility.

- [ ] **Step 4: Add the TypeScript format shape**

In resources/js/types/ogc.ts, add before OgcNormalizedOutput:

    export type OgcOutputFormat = {
        label: string;
        mediaType: string;
        encoding?: string;
        schema?: string | Record<string, unknown>;
    };

Then add this required property to OgcNormalizedOutput:

    formats: OgcOutputFormat[];

- [ ] **Step 5: Run tests and static type checking**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
    bun run types:check

Expected: both PASS. Any fixture expectation that compares the entire normalized output must be updated to include formats rather than weakening the assertion.

- [ ] **Step 6: Format and commit**

Run:

    vendor/bin/pint --dirty --format agent
    bun run format
    git add app/Services/Ogc/ProcessSchemaNormalizer.php resources/js/types/ogc.ts tests/Unit/Ogc/ProcessSchemaNormalizerTest.php
    git commit -m "feat: expose selectable output formats"

## Task 3: Validate Selection And Build The Canonical Remote Output Map

**Files:**

- Modify: tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php
- Modify: app/Services/Ogc/ProcessOutputRequestBuilder.php
- Modify: app/Http/Requests/Ogc/StoreProcessExecutionRequest.php
- Modify: app/Http/Controllers/Ogc/ProcessExecutionController.php
- Modify: tests/Feature/Ogc/ProcessExecutionTest.php
- Modify: lang/it.json

- [ ] **Step 1: Replace the builder expectations with canonical format-aware requests**

Replace tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php with:

    <?php

    use App\Services\Ogc\ProcessOutputRequestBuilder;
    use Illuminate\Validation\ValidationException;
    use Tests\TestCase;

    uses(TestCase::class);

    test('it defaults to all conduit outputs with trusted formats and automatic transmission modes', function () {
        $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-conduit'),
        );

        expect($outputs)->toBe(expectedConduitOutputRequestsForBuilder());
    });

    test('it defaults to formats only where pybox advertises a top level media type', function () {
        $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-pybox'),
        );

        expect($outputs)->toBe([
            'input_data' => [
                'format' => ['mediaType' => 'text/plain'],
                'transmissionMode' => 'value',
            ],
            'dem' => ['transmissionMode' => 'reference'],
            'invasion_map' => ['transmissionMode' => 'reference'],
            'spatial_evolution' => [
                'format' => [
                    'mediaType' => 'application/json',
                    'schema' => '#/$defs/chart',
                ],
                'transmissionMode' => 'value',
            ],
            'deposit_thickness' => [
                'format' => [
                    'mediaType' => 'application/json',
                    'schema' => '#/$defs/chart',
                ],
                'transmissionMode' => 'value',
            ],
        ]);
    });

    test('it defaults solwcad to the first format and accepts its second format', function () {
        $builder = app(ProcessOutputRequestBuilder::class);
        $process = ogcFixture('process-solwcad');

        expect($builder->forProcess($process))->toBe([
            'solwcad_out' => [
                'format' => ['mediaType' => 'application/json'],
                'transmissionMode' => 'value',
            ],
        ])->and($builder->forProcess($process, [
            'solwcad_out' => [
                'format' => ['mediaType' => 'text/plain'],
            ],
        ]))->toBe([
            'solwcad_out' => [
                'format' => ['mediaType' => 'text/plain'],
                'transmissionMode' => 'value',
            ],
        ]);
    });

    test('it requests only the selected top level outputs', function () {
        $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-conduit'),
            [
                'outfile' => [
                    'format' => ['mediaType' => 'text/csv'],
                ],
                'exit' => [],
            ],
        );

        expect($outputs)->toBe([
            'outfile' => [
                'format' => ['mediaType' => 'text/csv'],
                'transmissionMode' => 'reference',
            ],
            'exit' => [
                'format' => ['mediaType' => 'text/plain'],
                'transmissionMode' => 'value',
            ],
        ]);
    });

    test('it accepts an explicitly empty selection', function () {
        expect(app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-conduit'),
            [],
        ))->toBe([]);
    });

    test('it rejects unknown output identifiers', function () {
        try {
            app(ProcessOutputRequestBuilder::class)->forProcess(
                ogcFixture('process-conduit'),
                ['unknown' => []],
            );
        } catch (ValidationException $exception) {
            expect($exception->errors())->toBe([
                'outputs.unknown' => [
                    'This output is not available.',
                ],
            ]);

            return;
        }

        $this->fail('Expected an unknown output validation error.');
    });

    test('it rejects output formats not advertised by the process', function () {
        try {
            app(ProcessOutputRequestBuilder::class)->forProcess(
                ogcFixture('process-solwcad'),
                [
                    'solwcad_out' => [
                        'format' => ['mediaType' => 'application/xml'],
                    ],
                ],
            );
        } catch (ValidationException $exception) {
            expect($exception->errors())->toBe([
                'outputs.solwcad_out.format' => [
                    'This output format is not available.',
                ],
            ]);

            return;
        }

        $this->fail('Expected an unknown output format validation error.');
    });

    function expectedConduitOutputRequestsForBuilder(): array
    {
        $chartFormat = [
            'mediaType' => 'application/json',
            'schema' => '#/$defs/chart',
        ];

        return [
            'gas' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'velocity' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'pressure' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'outfile' => [
                'format' => ['mediaType' => 'text/csv'],
                'transmissionMode' => 'reference',
            ],
            'exit' => [
                'format' => ['mediaType' => 'text/plain'],
                'transmissionMode' => 'value',
            ],
        ];
    }

- [ ] **Step 2: Run builder tests and verify RED**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php

Expected: FAIL because forProcess does not accept a selection and does not emit format.

- [ ] **Step 3: Replace the request builder with trusted reconstruction**

Replace app/Services/Ogc/ProcessOutputRequestBuilder.php with:

    <?php

    namespace App\Services\Ogc;

    use Illuminate\Validation\ValidationException;

    class ProcessOutputRequestBuilder
    {
        public function __construct(
            private ProcessOutputFormatExtractor $outputFormatExtractor,
        ) {}

        /**
         * A null selection means a legacy caller omitted outputs and therefore requests all.
         * An empty selection means the caller explicitly requests no outputs.
         *
         * @param  array<string, mixed>  $process
         * @param  array<string, array<string, mixed>>|null  $selection
         * @return array<string, array{format?: array<string, mixed>, transmissionMode: string}>
         */
        public function forProcess(array $process, ?array $selection = null): array
        {
            $availableOutputs = $this->availableOutputs($process);
            $selectedOutputs = $selection ?? array_fill_keys(
                array_keys($availableOutputs),
                [],
            );
            $requests = [];

            foreach ($selectedOutputs as $outputId => $configuration) {
                $outputId = (string) $outputId;
                $output = $availableOutputs[$outputId] ?? null;

                if (! is_array($output)) {
                    throw ValidationException::withMessages([
                        "outputs.{$outputId}" => __('This output is not available.'),
                    ]);
                }

                if (! is_array($configuration)) {
                    throw ValidationException::withMessages([
                        "outputs.{$outputId}" => __('The outputs must be an object keyed by output identifier.'),
                    ]);
                }

                $format = $this->formatForOutput(
                    outputId: $outputId,
                    output: $output,
                    configuration: $configuration,
                );

                $requests[$outputId] = [
                    ...($format === null ? [] : ['format' => $format]),
                    'transmissionMode' => $this->transmissionMode($output),
                ];
            }

            return $requests;
        }

        /**
         * @param  array<string, mixed>  $process
         * @return array<string, array<string, mixed>>
         */
        private function availableOutputs(array $process): array
        {
            $available = [];

            foreach ($process['outputs'] ?? [] as $outputId => $output) {
                if (is_array($output)) {
                    $available[(string) $outputId] = $output;
                }
            }

            return $available;
        }

        /**
         * @param  array<string, mixed>  $output
         * @param  array<string, mixed>  $configuration
         * @return array<string, mixed>|null
         */
        private function formatForOutput(
            string $outputId,
            array $output,
            array $configuration,
        ): ?array {
            $schema = is_array($output['schema'] ?? null)
                ? $output['schema']
                : [];
            $formats = $this->outputFormatExtractor->formats($schema);

            if (! array_key_exists('format', $configuration)) {
                return $formats === []
                    ? null
                    : $this->outputFormatExtractor->requestFormat($formats[0]);
            }

            $requestedFormat = $configuration['format'];

            if (! is_array($requestedFormat)) {
                $this->throwUnknownFormat($outputId);
            }

            foreach ($formats as $format) {
                $trustedFormat = $this->outputFormatExtractor->requestFormat($format);

                if ($this->formatsMatch($requestedFormat, $trustedFormat)) {
                    return $trustedFormat;
                }
            }

            return $this->throwUnknownFormat($outputId);
        }

        /**
         * @param  array<string, mixed>  $requested
         * @param  array<string, mixed>  $trusted
         */
        private function formatsMatch(array $requested, array $trusted): bool
        {
            if (array_diff(array_keys($requested), ['mediaType', 'encoding', 'schema']) !== []) {
                return false;
            }

            return $this->canonicalize($requested) === $this->canonicalize($trusted);
        }

        private function canonicalize(mixed $value): mixed
        {
            if (! is_array($value)) {
                return $value;
            }

            if (array_is_list($value)) {
                return array_map($this->canonicalize(...), $value);
            }

            $canonical = [];

            foreach ($value as $key => $item) {
                $canonical[$key] = $this->canonicalize($item);
            }

            ksort($canonical);

            return $canonical;
        }

        private function throwUnknownFormat(string $outputId): never
        {
            throw ValidationException::withMessages([
                "outputs.{$outputId}.format" => __('This output format is not available.'),
            ]);
        }

        /**
         * @param  array<string, mixed>  $output
         */
        private function transmissionMode(array $output): string
        {
            return $this->hasInlineMediaType($output['schema'] ?? []) ? 'value' : 'reference';
        }

        private function hasInlineMediaType(mixed $schema): bool
        {
            if (! is_array($schema)) {
                return false;
            }

            $mediaType = $this->baseMediaType($schema['contentMediaType'] ?? null);

            if ($this->isInlineMediaType($mediaType)) {
                return true;
            }

            foreach (['oneOf', 'anyOf', 'allOf'] as $compositionKey) {
                foreach (($schema[$compositionKey] ?? []) as $subSchema) {
                    if ($this->hasInlineMediaType($subSchema)) {
                        return true;
                    }
                }
            }

            return false;
        }

        private function isInlineMediaType(?string $mediaType): bool
        {
            return $mediaType === 'text/plain'
                || $mediaType === 'application/json'
                || ($mediaType !== null && str_ends_with($mediaType, '+json'));
        }

        private function baseMediaType(mixed $mediaType): ?string
        {
            if (! is_string($mediaType) || trim($mediaType) === '') {
                return null;
            }

            return strtolower(trim(strtok($mediaType, ';') ?: $mediaType));
        }
    }

Do not accept a browser-provided transmissionMode and do not infer a default format on the browser input. The trusted first format comes from the process description.

- [ ] **Step 4: Verify the builder is GREEN**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php

Expected: PASS.

- [ ] **Step 5: Add structural request validation and missing-versus-empty access**

In StoreProcessExecutionRequest.php import Closure:

    use Closure;

Add these entries to rules:

    'outputs' => ['sometimes', 'array'],
    'outputs.*' => ['array:format'],
    'outputs.*.format' => ['sometimes', 'array:mediaType,encoding,schema'],
    'outputs.*.format.mediaType' => [
        'required_with:outputs.*.format',
        'string',
    ],
    'outputs.*.format.encoding' => ['sometimes', 'string'],
    'outputs.*.format.schema' => [
        'sometimes',
        function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) && ! is_array($value)) {
                $fail(__('The output format schema must be a string or object.'));
            }
        },
    ],

At the beginning of the existing after-validation closure, add:

    $outputs = $this->input('outputs');

    if (
        $this->has('outputs')
        && is_array($outputs)
        && $outputs !== []
        && array_is_list($outputs)
    ) {
        $validator->errors()->add(
            'outputs',
            __('The outputs must be an object keyed by output identifier.'),
        );
    }

Keep the existing note-size validation below it.

Add this public accessor:

    /**
     * @return array<string, array<string, mixed>>|null
     */
    public function outputSelection(): ?array
    {
        if (! $this->has('outputs')) {
            return null;
        }

        $outputs = $this->validated('outputs');

        return is_array($outputs) ? $outputs : [];
    }

The explicit has check is required. Do not use filled, blank, truthiness, or a default that collapses [] and null.

- [ ] **Step 6: Pass the selection into the builder**

In ProcessExecutionController::store, replace:

    'outputs' => $outputRequestBuilder->forProcess($processDescription),

with:

    'outputs' => $outputRequestBuilder->forProcess(
        $processDescription,
        $request->outputSelection(),
    ),

The builder may throw ValidationException. Let Laravel return those errors naturally; do not catch and convert them to a remote execution failure.

- [ ] **Step 7: Add Italian validation translations**

Add these entries to lang/it.json, preserving valid JSON and alphabetical/local file conventions:

    "The output format schema must be a string or object.": "Lo schema del formato di output deve essere una stringa o un oggetto.",
    "The outputs must be an object keyed by output identifier.": "Gli output devono essere un oggetto indicizzato per identificatore di output.",
    "This output format is not available.": "Questo formato di output non è disponibile.",
    "This output is not available.": "Questo output non è disponibile."

- [ ] **Step 8: Update the main controller feature test to select one trusted output**

In the first test in ProcessExecutionTest.php, replace the browser payload outputs with:

    'outputs' => [
        'gas' => [
            'format' => [
                'mediaType' => 'application/json',
                'schema' => '#/$defs/chart',
            ],
        ],
    ],

Set expectedOutputs to:

    $expectedOutputs = [
        'gas' => [
            'format' => [
                'mediaType' => 'application/json',
                'schema' => '#/$defs/chart',
            ],
            'transmissionMode' => 'value',
        ],
    ];

Keep the existing assertions proving the exact canonical map is persisted and dispatched.

- [ ] **Step 9: Add feature coverage for compatibility, empty selection, and rejection**

Add these tests near the other controller store tests:

    test('starting a process without outputs requests every advertised output', function () {
        Bus::fake();
        Http::preventStrayRequests();

        $user = User::factory()->create();
        app(OgcProcessCache::class)->putProcess(
            'conduit',
            ogcFixture('process-conduit'),
        );

        $this->actingAs($user)->post(
            route('processes.jobs.store', 'conduit'),
            ['inputs' => conduitExampleInputs()],
        )->assertRedirect();

        $execution = ProcessExecution::query()->sole();

        expect($execution->requested_outputs)->toBe(
            expectedConduitOutputRequestsForExecution(),
        );

        Bus::assertDispatched(
            SubmitProcessExecutionJob::class,
            fn (SubmitProcessExecutionJob $job): bool =>
                $job->payload['outputs'] ===
                    expectedConduitOutputRequestsForExecution(),
        );
    });

    test('starting a process accepts an explicitly empty output selection', function () {
        Bus::fake();
        Http::preventStrayRequests();

        $user = User::factory()->create();
        app(OgcProcessCache::class)->putProcess(
            'conduit',
            ogcFixture('process-conduit'),
        );

        $this->actingAs($user)->post(
            route('processes.jobs.store', 'conduit'),
            [
                'inputs' => conduitExampleInputs(),
                'outputs' => [],
            ],
        )->assertRedirect();

        $execution = ProcessExecution::query()->sole();

        expect($execution->requested_outputs)->toBe([]);

        Bus::assertDispatched(
            SubmitProcessExecutionJob::class,
            fn (SubmitProcessExecutionJob $job): bool =>
                $job->payload['outputs'] === [],
        );
    });

    test('starting a process rejects unknown output identifiers and formats', function (
        array $outputs,
        string $errorKey,
    ) {
        Bus::fake();
        Http::preventStrayRequests();

        $user = User::factory()->create();
        $inputs = ogcFixture(
            'process-solwcad',
        )['examples'][0]['payload_example']['inputs'];
        app(OgcProcessCache::class)->putProcess(
            'solwcad',
            ogcFixture('process-solwcad'),
        );

        $this->actingAs($user)->post(
            route('processes.jobs.store', 'solwcad'),
            [
                'inputs' => $inputs,
                'outputs' => $outputs,
            ],
        )->assertInvalid([$errorKey]);

        expect(ProcessExecution::query()->count())->toBe(0);
        Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
        Http::assertNothingSent();
    })->with([
        'unknown output' => [
            ['unknown' => []],
            'outputs.unknown',
        ],
        'unknown format' => [
            [
                'solwcad_out' => [
                    'format' => ['mediaType' => 'application/xml'],
                ],
            ],
            'outputs.solwcad_out.format',
        ],
    ]);

    test('starting a process rejects positional outputs and client transmission mode', function (
        array $outputs,
        string $errorKey,
    ) {
        Bus::fake();
        Http::preventStrayRequests();

        $user = User::factory()->create();
        $inputs = ogcFixture(
            'process-solwcad',
        )['examples'][0]['payload_example']['inputs'];
        app(OgcProcessCache::class)->putProcess(
            'solwcad',
            ogcFixture('process-solwcad'),
        );

        $this->actingAs($user)->post(
            route('processes.jobs.store', 'solwcad'),
            [
                'inputs' => $inputs,
                'outputs' => $outputs,
            ],
        )->assertInvalid([$errorKey]);

        expect(ProcessExecution::query()->count())->toBe(0);
        Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    })->with([
        'positional list' => [
            [['format' => ['mediaType' => 'application/json']]],
            'outputs',
        ],
        'transmission mode' => [
            ['solwcad_out' => ['transmissionMode' => 'reference']],
            'outputs.solwcad_out',
        ],
    ]);

Add this uniquely named helper at the bottom of ProcessExecutionTest.php:

    function expectedConduitOutputRequestsForExecution(): array
    {
        $chartFormat = [
            'mediaType' => 'application/json',
            'schema' => '#/$defs/chart',
        ];

        return [
            'gas' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'velocity' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'pressure' => [
                'format' => $chartFormat,
                'transmissionMode' => 'value',
            ],
            'outfile' => [
                'format' => ['mediaType' => 'text/csv'],
                'transmissionMode' => 'reference',
            ],
            'exit' => [
                'format' => ['mediaType' => 'text/plain'],
                'transmissionMode' => 'value',
            ],
        ];
    }

- [ ] **Step 10: Update older browser POST payloads**

Find obsolete client-provided transmissionMode values:

    rg -n "post\(|transmissionMode" tests/Feature/Ogc/ProcessExecutionTest.php

For every payload passed through route('processes.jobs.store', ...):

- omit outputs when the test is unrelated and should exercise backward-compatible all-output behavior; or
- send only format under each selected output.

Do not remove transmissionMode from payloads passed directly to CreateProcessExecution or SubmitProcessExecution. Those are already canonical internal payloads and still need transmissionMode.

Keep the unit and feature helper names distinct because Pest can load both files in one PHP process.

- [ ] **Step 11: Run focused backend tests and verify GREEN**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php tests/Feature/Ogc/ProcessExecutionTest.php

Expected: PASS. Specifically verify:

- omitted outputs creates all canonical outputs;
- [] remains [];
- one selected output remains the only dispatched output;
- client transmissionMode is rejected;
- semantic errors create no ProcessExecution and dispatch no job.

- [ ] **Step 12: Format and commit**

Run:

    vendor/bin/pint --dirty --format agent
    git add app/Services/Ogc/ProcessOutputRequestBuilder.php app/Http/Requests/Ogc/StoreProcessExecutionRequest.php app/Http/Controllers/Ogc/ProcessExecutionController.php lang/it.json tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php tests/Feature/Ogc/ProcessExecutionTest.php
    git commit -m "feat: validate process output selection"

## Task 4: Serialize An Empty Output Map As A JSON Object

**Files:**

- Modify: tests/Unit/Ogc/OgcProcessesClientTest.php
- Modify: app/Services/Ogc/OgcProcessesClient.php

- [ ] **Step 1: Add a failing raw-body assertion**

In OgcProcessesClientTest.php add:

    test('it serializes an empty output map as a json object', function () {
        Http::fake([
            'https://voice.pi.ingv.it/geoinquire/processes/solwcad/execution' =>
                Http::response([], 201),
        ]);

        app(OgcProcessesClient::class)->execute(
            'solwcad',
            [
                'inputs' => [],
                'outputs' => [],
            ],
            'respond-async',
        );

        Http::assertSent(function (Request $request): bool {
            $json = json_decode(
                $request->body(),
                associative: false,
                flags: JSON_THROW_ON_ERROR,
            );

            return $json->outputs instanceof stdClass
                && get_object_vars($json->outputs) === [];
        });
    });

Add the imports if absent:

    use Illuminate\Http\Client\Request;
    use Illuminate\Support\Facades\Http;
    use stdClass;

- [ ] **Step 2: Run the test and verify RED**

Run:

    php artisan test --compact tests/Unit/Ogc/OgcProcessesClientTest.php --filter='serializes an empty output map'

Expected: FAIL because the current JSON body contains outputs: [].

- [ ] **Step 3: Convert only the HTTP-bound output map**

In OgcProcessesClient::execute, pass a transformed payload:

    ->post(
        $this->path("/processes/{$processId}/execution"),
        $this->payloadForTransport($payload),
    )

Add:

    /**
     * Keep job and model payloads as arrays, but serialize the OGC output map as an object.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function payloadForTransport(array $payload): array
    {
        if (
            array_key_exists('outputs', $payload)
            && is_array($payload['outputs'])
        ) {
            $payload['outputs'] = (object) $payload['outputs'];
        }

        return $payload;
    }

Do not cast the full payload and do not store stdClass in request_payload, requested_outputs, or queued job payloads.

- [ ] **Step 4: Run all client tests and verify GREEN**

Run:

    php artisan test --compact tests/Unit/Ogc/OgcProcessesClientTest.php

Expected: PASS, including existing headers, retries, and host-safety tests.

- [ ] **Step 5: Format and commit**

Run:

    vendor/bin/pint --dirty --format agent
    git add app/Services/Ogc/OgcProcessesClient.php tests/Unit/Ogc/OgcProcessesClientTest.php
    git commit -m "fix: serialize empty OGC outputs as object"

## Task 5: Complete Zero-Output Executions Without Synthetic Results

**Files:**

- Create: tests/Unit/Ogc/OgcResultResponseParserTest.php
- Modify: app/Services/Ogc/OgcResultResponseParser.php
- Modify: app/Actions/Ogc/StoreProcessResult.php
- Modify: app/Actions/Ogc/PollProcessExecution.php
- Modify: tests/Feature/Ogc/PollProcessExecutionJobTest.php
- Modify: tests/Feature/Ogc/ProcessExecutionTest.php

- [ ] **Step 1: Scaffold the parser test**

Run:

    php artisan make:test --pest --unit OgcResultResponseParserTest --no-interaction
    mv tests/Unit/OgcResultResponseParserTest.php tests/Unit/Ogc/OgcResultResponseParserTest.php

- [ ] **Step 2: Add failing parser tests for [] versus null**

Replace the generated test with:

    <?php

    use App\Models\ProcessExecution;
    use App\Services\Ogc\OgcResultResponseParser;
    use GuzzleHttp\Psr7\Response as Psr7Response;
    use Illuminate\Http\Client\Response;
    use Tests\TestCase;

    uses(TestCase::class);

    test('it returns no parsed results for an explicit empty requested output map', function () {
        $execution = ProcessExecution::factory()->make([
            'requested_outputs' => [],
            'process_outputs' => ogcFixture('process-conduit')['outputs'],
        ]);
        $response = new Response(new Psr7Response(
            200,
            ['Content-Type' => 'application/json'],
            json_encode(ogcFixture('chart-result'), JSON_THROW_ON_ERROR),
        ));

        expect(app(OgcResultResponseParser::class)->parse(
            $execution,
            $response,
        ))->toBe([]);
    });

    test('it retains the historical result fallback when requested outputs are null', function () {
        $execution = ProcessExecution::factory()->make([
            'requested_outputs' => null,
            'process_outputs' => [],
        ]);
        $response = new Response(new Psr7Response(
            200,
            ['Content-Type' => 'application/json'],
            '{"value":42}',
        ));

        $results = app(OgcResultResponseParser::class)->parse(
            $execution,
            $response,
        );

        expect($results)->toHaveCount(1)
            ->and($results[0]['output_id'])->toBe('result');
    });

- [ ] **Step 3: Run parser tests and verify RED**

Run:

    php artisan test --compact tests/Unit/Ogc/OgcResultResponseParserTest.php

Expected: the explicit-empty test FAILS because the parser invents the result identifier.

- [ ] **Step 4: Short-circuit only explicit empty output parsing**

At the beginning of OgcResultResponseParser::parse, before reading Content-Type, add:

    if ($outputId === null && $execution->requested_outputs === []) {
        return [];
    }

Do not change firstRequestedOutputId or the fallback inside resultsFromJsonBody. Those remain necessary for requested_outputs === null historical records and explicit outputId calls.

- [ ] **Step 5: Run parser tests and verify GREEN**

Run:

    php artisan test --compact tests/Unit/Ogc/OgcResultResponseParserTest.php

Expected: PASS for both explicit empty and historical null.

- [ ] **Step 6: Defensively short-circuit result storage**

At the beginning of StoreProcessResult::fromResponse add:

    if ($outputId === null && $execution->requested_outputs === []) {
        return;
    }

At the beginning of StoreProcessResult::fromLink add the same guard:

    if ($outputId === null && $execution->requested_outputs === []) {
        return;
    }

This prevents remote link downloads, storage writes, ProcessExecutionResult creation, and map-publication dispatch if another caller invokes the action directly.

- [ ] **Step 7: Skip the asynchronous results endpoint for zero-output jobs**

In the successful branch of PollProcessExecution::handle, wrap only the result-link/result-response retrieval block:

    if ($execution->requested_outputs !== []) {
        $resultLink = collect($job['links'] ?? [])
            ->first(fn (array $link): bool => str_contains(
                (string) ($link['rel'] ?? ''),
                'results',
            ));

        if (
            is_array($resultLink)
            && $this->shouldDeferResultDownload($resultLink)
        ) {
            $this->storeProcessResult->fromLink($execution, $resultLink);
        } else {
            $this->storeProcessResult->fromResponse(
                $execution,
                $this->client->jobResults($execution->remote_job_id),
            );
        }
    }

Leave the subsequent successful status update, completed_at, refresh, and notification outside the guard. Zero-output jobs still complete and notify normally.

- [ ] **Step 8: Add the failing asynchronous completion test**

Add to PollProcessExecutionJobTest.php:

    test('it completes a successful zero output job without requesting results', function () {
        Notification::fake();

        $execution = ProcessExecution::factory()->create([
            'remote_job_id' => 'job-no-outputs',
            'status' => ExecutionStatus::Running,
            'requested_outputs' => [],
        ]);

        Http::fake([
            'https://voice.pi.ingv.it/geoinquire/jobs/job-no-outputs?f=json' =>
                Http::response(ogcFixture('job-successful')),
        ]);

        (new PollProcessExecutionJob($execution->id))->handle(
            app(PollProcessExecution::class),
        );

        $execution->refresh();

        expect($execution->status)->toBe(ExecutionStatus::Successful)
            ->and($execution->completed_at)->not->toBeNull()
            ->and($execution->results)->toHaveCount(0);

        Http::assertSentCount(1);
        Http::assertNotSent(
            fn (Request $request): bool =>
                str_contains($request->url(), '/results'),
        );
        Notification::assertSentTo(
            $execution->user,
            ProcessExecutionCompleted::class,
        );
    });

Import Illuminate\Http\Client\Request if the test file does not already import it.

- [ ] **Step 9: Add synchronous zero-output coverage**

Add to ProcessExecutionTest.php near the existing synchronous execution test:

    test('it completes a synchronous zero output execution without storing results', function () {
        $user = User::factory()->create();
        $process = ogcFixture('process-conduit');
        $payload = [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7, 'tio2' => 0.01],
                ],
            ],
            'outputs' => [],
        ];
        $execution = app(CreateProcessExecution::class)->handle(
            $user,
            $process,
            $payload,
            ExecutionMode::Sync,
        );

        Http::fake([
            'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' =>
                Http::response(ogcFixture('chart-result')),
        ]);

        $execution = app(SubmitProcessExecution::class)->handle(
            $execution,
            $payload,
        );

        expect($execution->status)->toBe(ExecutionStatus::Successful)
            ->and($execution->requested_outputs)->toBe([])
            ->and($execution->results)->toHaveCount(0);

        Http::assertSentCount(1);
    });

- [ ] **Step 10: Run focused result-flow tests**

Run:

    php artisan test --compact tests/Unit/Ogc/OgcResultResponseParserTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/ProcessExecutionTest.php

Expected: PASS. Existing multipart, linked, binary, synchronous, and historical result cases must remain green.

- [ ] **Step 11: Format and commit**

Run:

    vendor/bin/pint --dirty --format agent
    git add app/Services/Ogc/OgcResultResponseParser.php app/Actions/Ogc/StoreProcessResult.php app/Actions/Ogc/PollProcessExecution.php tests/Unit/Ogc/OgcResultResponseParserTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/ProcessExecutionTest.php
    git commit -m "fix: support executions without requested outputs"

## Task 6: Build And Test Pure Frontend Selection State

**Files:**

- Create: resources/js/lib/process-output-selection.ts
- Create: tests/Frontend/process-output-selection.test.ts

- [ ] **Step 1: Write the failing Bun tests**

Create tests/Frontend/process-output-selection.test.ts:

    import { describe, expect, test } from 'bun:test';

    import {
        buildRequestedOutputs,
        firstOutputError,
        initialOutputSelections,
        outputFormatKey,
        outputFormatLabel,
        setOutputFormat,
        setOutputSelected,
    } from '../../resources/js/lib/process-output-selection';
    import type {
        OgcNormalizedOutput,
        OgcOutputFormat,
    } from '../../resources/js/types';

    const jsonFormat: OgcOutputFormat = {
        label: 'JSON Array',
        mediaType: 'application/json',
    };
    const textFormat: OgcOutputFormat = {
        label: 'Plain text Array',
        mediaType: 'text/plain',
    };
    const chartFormat: OgcOutputFormat = {
        label: 'application/json',
        mediaType: 'application/json',
        schema: {
            type: 'object',
            required: ['series'],
        },
    };
    const outputs: Record<string, OgcNormalizedOutput> = {
        solwcad_out: {
            name: 'solwcad_out',
            title: 'Output result',
            formats: [jsonFormat, textFormat],
        },
        chart: {
            name: 'chart',
            title: 'Chart',
            formats: [chartFormat],
        },
        unqualified: {
            name: 'unqualified',
            title: 'Unqualified file',
            formats: [],
        },
    };

    describe('process output selection', () => {
        test('selects every output and the first advertised format initially', () => {
            expect(initialOutputSelections(outputs)).toEqual({
                solwcad_out: {
                    selected: true,
                    format: jsonFormat,
                },
                chart: {
                    selected: true,
                    format: chartFormat,
                },
                unqualified: {
                    selected: true,
                    format: null,
                },
            });
        });

        test('preserves the chosen format while deselecting and reselecting', () => {
            let selections = initialOutputSelections(outputs);

            selections = setOutputFormat(
                selections,
                'solwcad_out',
                textFormat,
            );
            selections = setOutputSelected(
                selections,
                'solwcad_out',
                false,
            );
            selections = setOutputSelected(
                selections,
                'solwcad_out',
                true,
            );

            expect(selections.solwcad_out).toEqual({
                selected: true,
                format: textFormat,
            });
        });

        test('serializes only selected outputs and removes display labels', () => {
            let selections = initialOutputSelections(outputs);

            selections = setOutputFormat(
                selections,
                'solwcad_out',
                textFormat,
            );
            selections = setOutputSelected(selections, 'chart', false);

            expect(buildRequestedOutputs(selections)).toEqual({
                solwcad_out: {
                    format: {
                        mediaType: 'text/plain',
                    },
                },
                unqualified: {},
            });
        });

        test('serializes no selected outputs as an empty object', () => {
            let selections = initialOutputSelections(outputs);

            for (const outputId of Object.keys(selections)) {
                selections = setOutputSelected(
                    selections,
                    outputId,
                    false,
                );
            }

            expect(buildRequestedOutputs(selections)).toEqual({});
        });

        test('keeps encoding and schema in the request qualifier', () => {
            const selections = {
                chart: {
                    selected: true,
                    format: {
                        ...chartFormat,
                        encoding: 'utf-8',
                    },
                },
            };

            expect(buildRequestedOutputs(selections)).toEqual({
                chart: {
                    format: {
                        mediaType: 'application/json',
                        encoding: 'utf-8',
                        schema: {
                            type: 'object',
                            required: ['series'],
                        },
                    },
                },
            });
        });

        test('builds stable select keys and readable labels', () => {
            expect(outputFormatKey(jsonFormat)).toBe(
                outputFormatKey({ ...jsonFormat }),
            );
            expect(outputFormatLabel(jsonFormat)).toBe(
                'JSON Array — application/json',
            );
            expect(outputFormatLabel(chartFormat)).toBe('application/json');
        });

        test('returns the first nested output validation error', () => {
            expect(
                firstOutputError({
                    name: 'Ignore',
                    'outputs.solwcad_out.format':
                        'This output format is not available.',
                }),
            ).toBe('This output format is not available.');
            expect(firstOutputError({ inputs: 'Ignore' })).toBeUndefined();
        });
    });

- [ ] **Step 2: Run the test and verify RED**

Run:

    bun test tests/Frontend/process-output-selection.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure state module**

Create resources/js/lib/process-output-selection.ts:

    import type {
        OgcNormalizedOutput,
        OgcOutputFormat,
    } from '@/types';

    export type ProcessOutputSelection = {
        selected: boolean;
        format: OgcOutputFormat | null;
    };

    export type ProcessOutputSelections = Record<
        string,
        ProcessOutputSelection
    >;

    export type ProcessOutputRequest = Record<
        string,
        {
            format?: {
                mediaType: string;
                encoding?: string;
                schema?: string | Record<string, unknown>;
            };
        }
    >;

    export function initialOutputSelections(
        outputs: Record<string, OgcNormalizedOutput>,
    ): ProcessOutputSelections {
        return Object.fromEntries(
            Object.entries(outputs).map(([outputId, output]) => [
                outputId,
                {
                    selected: true,
                    format: output.formats[0] ?? null,
                },
            ]),
        );
    }

    export function setOutputSelected(
        selections: ProcessOutputSelections,
        outputId: string,
        selected: boolean,
    ): ProcessOutputSelections {
        const current = selections[outputId];

        if (!current) {
            return selections;
        }

        return {
            ...selections,
            [outputId]: {
                ...current,
                selected,
            },
        };
    }

    export function setOutputFormat(
        selections: ProcessOutputSelections,
        outputId: string,
        format: OgcOutputFormat,
    ): ProcessOutputSelections {
        const current = selections[outputId];

        if (!current) {
            return selections;
        }

        return {
            ...selections,
            [outputId]: {
                ...current,
                format,
            },
        };
    }

    export function buildRequestedOutputs(
        selections: ProcessOutputSelections,
    ): ProcessOutputRequest {
        return Object.fromEntries(
            Object.entries(selections)
                .filter(([, selection]) => selection.selected)
                .map(([outputId, selection]) => [
                    outputId,
                    selection.format
                        ? {
                              format: requestFormat(selection.format),
                          }
                        : {},
                ]),
        );
    }

    export function outputFormatKey(format: OgcOutputFormat): string {
        return JSON.stringify(
            canonicalize({
                mediaType: format.mediaType,
                encoding: format.encoding ?? null,
                schema: format.schema ?? null,
            }),
        );
    }

    export function outputFormatLabel(format: OgcOutputFormat): string {
        return format.label === format.mediaType
            ? format.mediaType
            : format.label + ' — ' + format.mediaType;
    }

    export function firstOutputError(
        errors: Record<string, string | undefined>,
    ): string | undefined {
        return Object.entries(errors).find(
            ([key, value]) =>
                Boolean(value) &&
                (key === 'outputs' || key.startsWith('outputs.')),
        )?.[1];
    }

    function requestFormat(format: OgcOutputFormat) {
        return {
            mediaType: format.mediaType,
            ...(format.encoding ? { encoding: format.encoding } : {}),
            ...(format.schema !== undefined
                ? { schema: format.schema }
                : {}),
        };
    }

    function canonicalize(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map(canonicalize);
        }

        if (!isRecord(value)) {
            return value;
        }

        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonicalize(value[key])]),
        );
    }

    function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

- [ ] **Step 4: Run pure tests and type checking**

Run:

    bun test tests/Frontend/process-output-selection.test.ts
    bun run types:check

Expected: PASS. The exact empty result must be a plain JavaScript object, not null or an array.

- [ ] **Step 5: Format and commit**

Run:

    bun run format
    git add resources/js/lib/process-output-selection.ts tests/Frontend/process-output-selection.test.ts
    git commit -m "feat: model process output selection state"

## Task 7: Replace The Read-Only Output List With An Accessible Selector

**Files:**

- Create: resources/js/components/ogc/process-output-selector.tsx
- Modify: resources/js/components/ogc/dynamic-process-form.tsx
- Modify: resources/js/lib/i18n/messages.ts
- Modify: tests/Frontend/i18n.test.ts
- Modify: tests/Unit/ProcessUiLayoutTest.php
- Delete: resources/js/components/ogc/expected-outputs.tsx

- [ ] **Step 1: Replace obsolete static source assertions with failing selector assertions**

In ProcessUiLayoutTest.php rename the first test to:

    process form stacks name inputs selectable outputs and note as full width sections

Change its expectations so they include:

    ->toContain('ProcessOutputSelector')
    ->toContain('outputs: initialOutputSelections(schema.outputs)')
    ->toContain("setData('outputs'")
    ->toContain('buildRequestedOutputs(')
    ->not->toContain('ExpectedOutputs')

Remove the old negative assertions for OutputSelector, output state, and setData.

Replace the test named expected outputs renders a simple unordered list with:

    test('process output selector renders checkboxes formats and empty selection feedback', function () {
        $source = file_get_contents(
            getcwd().'/resources/js/components/ogc/process-output-selector.tsx',
        );

        expect($source)
            ->toContain('<Checkbox')
            ->toContain('checked={selection.selected}')
            ->toContain('setOutputSelected')
            ->toContain('<Select')
            ->toContain('output.formats.length > 1')
            ->toContain('output.formats.length === 1')
            ->toContain('disabled={!selection.selected}')
            ->toContain("t('ogc.outputFormat')")
            ->toContain("t('ogc.noOutputsSelected')")
            ->toContain('<InputError message={error}');
    });

Replace the test named process form does not expose output selection controls with:

    test('process form sends output selections without browser transmission modes', function () {
        $source = file_get_contents(
            getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx',
        );
        $helperSource = file_get_contents(
            getcwd().'/resources/js/lib/process-output-selection.ts',
        );

        expect($source)
            ->toContain('<ProcessOutputSelector')
            ->toContain('initialOutputSelections(schema.outputs)')
            ->toContain('buildRequestedOutputs')
            ->toContain("setData('outputs'")
            ->toContain('firstOutputError')
            ->not->toContain('ExpectedOutputs');

        expect($helperSource)
            ->toContain('mediaType: format.mediaType')
            ->toContain('encoding: format.encoding')
            ->toContain('schema: format.schema')
            ->not->toContain('transmissionMode');
    });

These source tests should assert behavior-significant wiring and avoid formatting-dependent whitespace.

- [ ] **Step 2: Add failing translation assertions**

In tests/Frontend/i18n.test.ts add:

    test('translates process output selection controls', () => {
        expect(translate('it', 'ogc.outputFormat')).toBe('Formato output');
        expect(translate('en', 'ogc.outputFormat')).toBe('Output format');
        expect(translate('it', 'ogc.noOutputsSelected')).toBe(
            'Nessun output verrà richiesto',
        );
        expect(translate('en', 'ogc.noOutputsSelected')).toBe(
            'No outputs will be requested',
        );
    });

- [ ] **Step 3: Run the UI contract tests and verify RED**

Run:

    php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter='output'
    bun test tests/Frontend/i18n.test.ts

Expected: FAIL because the selector and translations do not exist.

- [ ] **Step 4: Add Italian and English UI messages**

In both ogc objects in resources/js/lib/i18n/messages.ts add matching keys.

Italian:

    checkProcessData: 'Controlla i dati del processo',
    noOutputsSelected: 'Nessun output verrà richiesto',
    noOutputsSelectedDescription:
        'Il processo verrà avviato senza richiedere risultati.',
    outputFormat: 'Formato output',
    selectOutputsDescription:
        'Scegli gli output da richiedere e, quando disponibile, il formato desiderato.',

English:

    checkProcessData: 'Check the process data',
    noOutputsSelected: 'No outputs will be requested',
    noOutputsSelectedDescription:
        'The process will start without requesting results.',
    outputFormat: 'Output format',
    selectOutputsDescription:
        'Choose the outputs to request and, when available, the preferred format.',

Keep existing expectedOutputs messages unless a separate cleanup is justified; removing translation keys is not required by this feature.

- [ ] **Step 5: Create the interactive selector**

Create resources/js/components/ogc/process-output-selector.tsx:

    import { InfoIcon } from 'lucide-react';

    import InputError from '@/components/input-error';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from '@/components/ui/card';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Field, FieldLabel } from '@/components/ui/field';
    import { Label } from '@/components/ui/label';
    import {
        Select,
        SelectContent,
        SelectGroup,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from '@/components/ui/select';
    import { useTranslation } from '@/hooks/use-translation';
    import {
        outputFormatKey,
        outputFormatLabel,
        setOutputFormat,
        setOutputSelected,
        type ProcessOutputSelections,
    } from '@/lib/process-output-selection';
    import type {
        OgcNormalizedOutput,
        OgcOutputFormat,
    } from '@/types';

    type ProcessOutputSelectorProps = {
        outputs: Record<string, OgcNormalizedOutput>;
        selections: ProcessOutputSelections;
        onChange: (selections: ProcessOutputSelections) => void;
        error?: string;
    };

    export default function ProcessOutputSelector({
        outputs,
        selections,
        onChange,
        error,
    }: ProcessOutputSelectorProps) {
        const { t } = useTranslation();
        const hasSelectedOutputs = Object.values(selections).some(
            (selection) => selection.selected,
        );

        return (
            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>{t('ogc.outputs')}</CardTitle>
                    <CardDescription>
                        {t('ogc.selectOutputsDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-3">
                        {Object.entries(outputs).map(
                            ([outputId, output]) => {
                                const selection = selections[outputId];

                                if (!selection) {
                                    return null;
                                }

                                return (
                                    <OutputSelectionRow
                                        key={outputId}
                                        outputId={outputId}
                                        output={output}
                                        selection={selection}
                                        onSelectedChange={(selected) =>
                                            onChange(
                                                setOutputSelected(
                                                    selections,
                                                    outputId,
                                                    selected,
                                                ),
                                            )
                                        }
                                        onFormatChange={(format) =>
                                            onChange(
                                                setOutputFormat(
                                                    selections,
                                                    outputId,
                                                    format,
                                                ),
                                            )
                                        }
                                    />
                                );
                            },
                        )}
                    </div>

                    {!hasSelectedOutputs ? (
                        <Alert>
                            <InfoIcon />
                            <AlertTitle>
                                {t('ogc.noOutputsSelected')}
                            </AlertTitle>
                            <AlertDescription>
                                {t('ogc.noOutputsSelectedDescription')}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <InputError message={error} />
                </CardContent>
            </Card>
        );
    }

    type OutputSelectionRowProps = {
        outputId: string;
        output: OgcNormalizedOutput;
        selection: ProcessOutputSelections[string];
        onSelectedChange: (selected: boolean) => void;
        onFormatChange: (format: OgcOutputFormat) => void;
    };

    function OutputSelectionRow({
        outputId,
        output,
        selection,
        onSelectedChange,
        onFormatChange,
    }: OutputSelectionRowProps) {
        const { t } = useTranslation();
        const controlId = controlIdForOutput(outputId);
        const formatControlId = controlId + '-format';
        const selectedFormatKey = selection.format
            ? outputFormatKey(selection.format)
            : undefined;

        return (
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                        id={controlId}
                        checked={selection.selected}
                        onCheckedChange={(checked) =>
                            onSelectedChange(checked === true)
                        }
                        aria-describedby={
                            output.description
                                ? controlId + '-description'
                                : undefined
                        }
                    />
                    <div className="min-w-0">
                        <Label
                            htmlFor={controlId}
                            className="cursor-pointer break-words"
                        >
                            {output.title}
                        </Label>
                        {output.description ? (
                            <p
                                id={controlId + '-description'}
                                className="mt-1 text-sm break-words text-muted-foreground"
                            >
                                {output.description}
                            </p>
                        ) : null}
                    </div>
                </div>

                {output.formats.length > 1 ? (
                    <Field className="min-w-0 sm:w-72">
                        <FieldLabel htmlFor={formatControlId}>
                            {t('ogc.outputFormat')}
                        </FieldLabel>
                        <Select
                            value={selectedFormatKey}
                            disabled={!selection.selected}
                            onValueChange={(key) => {
                                const format = output.formats.find(
                                    (candidate) =>
                                        outputFormatKey(candidate) === key,
                                );

                                if (format) {
                                    onFormatChange(format);
                                }
                            }}
                        >
                            <SelectTrigger
                                id={formatControlId}
                                className="w-full min-w-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {output.formats.map((format) => (
                                        <SelectItem
                                            key={outputFormatKey(format)}
                                            value={outputFormatKey(format)}
                                        >
                                            {outputFormatLabel(format)}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                ) : null}

                {output.formats.length === 1 ? (
                    <div className="min-w-0 sm:w-72">
                        <p className="text-xs font-medium text-muted-foreground">
                            {t('ogc.outputFormat')}
                        </p>
                        <p className="mt-1 text-sm break-words">
                            {outputFormatLabel(output.formats[0])}
                        </p>
                    </div>
                ) : null}
            </div>
        );
    }

    function controlIdForOutput(outputId: string): string {
        return 'process-output-' + encodeURIComponent(outputId);
    }

The single-format label is intentionally read-only. The multiple-format Select is disabled while its output is deselected, but its value remains in form state. Outputs with no advertised formats render no format control.

- [ ] **Step 6: Wire the selector into DynamicProcessForm**

Replace the ExpectedOutputs import with:

    import ProcessOutputSelector from '@/components/ogc/process-output-selector';

Add:

    import {
        buildRequestedOutputs,
        firstOutputError,
        initialOutputSelections,
        type ProcessOutputSelections,
    } from '@/lib/process-output-selection';

Change FormData to:

    type FormData = {
        name: string;
        inputs: Record<string, any>;
        note: TiptapDocument | null;
        outputs: ProcessOutputSelections;
    };

Add the initial output state:

    outputs: initialOutputSelections(schema.outputs),

Immediately after useForm, expose the state form used by the component:

    const outputSelections = data.outputs;

Change the global error heading:

    <AlertTitle>{t('ogc.checkProcessData')}</AlertTitle>

Extend the existing transform:

    transform((formData) => ({
        ...formData,
        inputs: normalizeInputs(schema.fields, formData.inputs),
        outputs: buildRequestedOutputs(formData.outputs),
    }));

Replace:

    <ExpectedOutputs outputs={schema.outputs} />

with:

    <ProcessOutputSelector
        outputs={schema.outputs}
        selections={outputSelections}
        onChange={(outputs) => setData('outputs', outputs)}
        error={firstOutputError(
            errors as Record<string, string | undefined>,
        )}
    />

Keep applyExamplePayload implemented with the currentData spread. Its only explicit replacement remains inputs, so output selection and format choices survive example prefill.

- [ ] **Step 7: Delete the obsolete component**

Delete:

    resources/js/components/ogc/expected-outputs.tsx

Confirm no imports remain:

    rg -n "ExpectedOutputs|expected-outputs" resources/js tests

Expected: no production references. Any remaining test reference must be an explicit negative assertion.

- [ ] **Step 8: Run frontend and UI tests**

Run:

    bun test tests/Frontend/process-output-selection.test.ts tests/Frontend/i18n.test.ts
    php artisan test --compact tests/Unit/ProcessUiLayoutTest.php
    bun run types:check
    bun run lint:check

Expected: PASS. If lint flags a type assertion around Inertia errors, introduce a narrowly typed local value; do not weaken global types with any.

- [ ] **Step 9: Format, build, and commit**

Run:

    bun run format
    bun run build
    git add resources/js/components/ogc/process-output-selector.tsx resources/js/components/ogc/dynamic-process-form.tsx resources/js/lib/process-output-selection.ts resources/js/lib/i18n/messages.ts resources/js/types/ogc.ts tests/Frontend/process-output-selection.test.ts tests/Frontend/i18n.test.ts tests/Unit/ProcessUiLayoutTest.php
    git add -u resources/js/components/ogc/expected-outputs.tsx
    git commit -m "feat: select process outputs and formats"

## Task 8: Verify The Complete Feature

**Files:**

- Verify all files changed in Tasks 1 through 7.
- Do not add ad hoc verification scripts.

- [ ] **Step 1: Run PHP formatting**

Run:

    vendor/bin/pint --dirty --format agent

Expected: command succeeds and formats only modified PHP files.

- [ ] **Step 2: Run the complete affected PHP test set**

Run:

    php artisan test --compact tests/Unit/Ogc/ProcessOutputFormatExtractorTest.php tests/Unit/Ogc/ProcessSchemaNormalizerTest.php tests/Unit/Ogc/ProcessOutputRequestBuilderTest.php tests/Unit/Ogc/OgcProcessesClientTest.php tests/Unit/Ogc/OgcResultResponseParserTest.php tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Unit/ProcessUiLayoutTest.php

Expected: PASS with no skipped or risky tests.

- [ ] **Step 3: Run the complete frontend test set**

Run:

    bun test tests/Frontend

Expected: PASS, including selection, translations, existing result grouping, maps, CSV, and output utilities.

- [ ] **Step 4: Run frontend quality gates**

Run:

    bun run types:check
    bun run lint:check
    bun run format:check
    bun run build

Expected: every command exits zero.

- [ ] **Step 5: Inspect the generated request behavior in tests**

Confirm the automated evidence includes all of these exact distinctions:

- no outputs request field: every process output is rebuilt and saved;
- one selected output: only that output is rebuilt and saved;
- one advertised format: format.mediaType is present;
- solwcad text choice: format.mediaType is text/plain;
- malicious transmissionMode: validation error and no dispatch;
- explicit empty selection: requested_outputs is [];
- outbound empty selection: raw JSON contains outputs as stdClass/JSON object;
- asynchronous empty selection: status is successful and the results URL is never called;
- synchronous empty selection: status is successful and zero results are stored;
- historical requested_outputs null: the parser still falls back to result.

- [ ] **Step 6: Inspect repository hygiene**

Run:

    git diff --check
    git status --short
    git diff --stat

Expected: no whitespace errors, no generated build artifacts accidentally tracked, no unrelated files changed, and no missing test files.

- [ ] **Step 7: Commit any formatter-only changes**

Only if Step 1 or Step 4 changed tracked files:

    git add -A
    git commit -m "style: format output selection changes"

Do not create an empty commit.

## Acceptance Checklist

- [ ] Every top-level process output is shown with a checkbox.
- [ ] All outputs start checked.
- [ ] The first advertised format starts selected.
- [ ] Multiple formats render an enabled Select only while the output is checked.
- [ ] A single format is visible, read-only, and still submitted explicitly.
- [ ] An output without a top-level advertised format remains selectable.
- [ ] Deselecting and reselecting preserves the chosen format.
- [ ] Deselecting every output leaves execution enabled and shows informational feedback.
- [ ] Example-data prefill does not reset output state.
- [ ] The browser never sends transmissionMode.
- [ ] Laravel rejects positional maps, unknown output IDs, unknown formats, and browser transmissionMode.
- [ ] Laravel reconstructs format and transmissionMode only from the cached process description.
- [ ] An omitted outputs field selects every output for backward compatibility.
- [ ] An explicit empty selection persists as [] and is sent remotely as outputs: {}.
- [ ] Explicit zero-output jobs complete without synthetic result records or result downloads.
- [ ] Historical null requested-output records retain their existing parser fallback.
- [ ] No database migration or dependency change is introduced.
