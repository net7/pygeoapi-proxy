<?php

use App\Actions\Ogc\CreateProcessExecution;
use App\Enums\Ogc\ExecutionMode;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Inertia::disableSsr();
});

test('the owner can review the submitted values and schema after the process changes', function () {
    Bus::fake([SubmitProcessExecutionJob::class]);
    Http::preventStrayRequests();
    $user = User::factory()->create();
    $process = [
        'id' => 'review-example',
        'version' => '1.0',
        'inputs' => [
            'pressure' => ['title' => 'Original pressure', 'schema' => ['type' => 'number']],
            'optional' => ['schema' => ['type' => 'number', 'default' => 99]],
            'mode' => ['schema' => ['oneOf' => [
                ['title' => 'First mode', 'properties' => ['a' => ['type' => 'number']]],
                ['title' => 'Second mode', 'properties' => ['b' => ['type' => 'number']]],
            ]]],
        ],
    ];
    app(OgcProcessCache::class)->putProcess('review-example', $process);

    $this->actingAs($user)->post(route('processes.jobs.store', 'review-example'), [
        'inputs' => ['pressure' => 0, 'mode' => ['variant' => '1', 'value' => ['b' => 12]]],
        'outputs' => [],
    ])->assertRedirect();
    $execution = ProcessExecution::query()->sole();
    $process['inputs']['pressure']['title'] = 'Changed pressure';
    $process['version'] = '2.0';
    app(OgcProcessCache::class)->putProcess('review-example', $process);

    $this->get(route('jobs.show', $execution))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.legacy', false)
        ->where('inputReview.fields.pressure.title', 'Original pressure')
        ->where('inputReview.inputs.pressure', 0)
        ->where('inputReview.inputs.mode.variant', '1')
        ->where('inputReview.inputs.mode.value.b', 12)
        ->missing('inputReview.inputs.optional')
        ->missing('execution.requestPayload'));

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->payload['inputs']['mode'] === ['value' => ['b' => 12]]);
    Http::assertNothingSent();
});

test('long submitted content is retained privately and can be reviewed and downloaded by its owner', function () {
    Storage::fake('local');
    $user = User::factory()->create();
    $content = str_repeat("1,2,3\n", 1500);
    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: ['id' => 'file-example', 'inputs' => ['data' => ['title' => 'Measurements', 'schema' => ['contentMediaType' => 'text/csv']]]],
        payload: ['inputs' => ['data' => ['value' => $content, 'mediaType' => 'text/csv']]],
        mode: ExecutionMode::Async,
        inputFiles: [['path' => ['data'], 'name' => 'measurements.csv']],
    );

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.inputs.data.value', $content)
        ->where('inputReview.files.0.name', 'measurements.csv')
        ->where('inputReview.files.0.sizeBytes', 9000)
        ->missing('inputReview.inputsPath')
        ->missing('execution.input_snapshot'));

    $response = $this->get(route('jobs.inputs.download', [$execution, 0]));
    $response->assertDownload('measurements.csv');
    expect($response->streamedContent())->toBe($content);
    Storage::disk('local')->assertExists($execution->input_snapshot['inputsPath']);
    expect($execution->request_payload['inputs']['data']['value'])->toBe('[redacted inline value]');
});

test('another user cannot read or download submitted inputs', function () {
    $execution = ProcessExecution::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get(route('jobs.show', $execution))->assertForbidden();
    $this->get(route('jobs.inputs.download', [$execution, 0]))->assertForbidden();
});

test('legacy requests expose available inputs without inventing missing values', function () {
    Http::preventStrayRequests();
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'process_id' => 'retired-process',
        'request_payload' => ['inputs' => [
            'pressure' => 0,
            'data' => ['value' => '[redacted inline value]', 'sizeBytes' => 4096],
        ]],
    ]);

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.legacy', true)
        ->where('inputReview.inputs.pressure', 0)
        ->where('inputReview.unavailableInputs', ['data'])
        ->missing('inputReview.inputs.data')
        ->has('inputReview.fields.pressure'));
    Http::assertNothingSent();
});

test('deleting a job removes its privately stored input content', function () {
    Storage::fake('local');
    $user = User::factory()->create();
    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: ['id' => 'large-input'],
        payload: ['inputs' => ['data' => str_repeat('x', 10000)]],
        mode: ExecutionMode::Async,
    );
    $path = $execution->input_snapshot['inputsPath'];

    $this->actingAs($user)->delete(route('jobs.destroy', $execution))->assertRedirect();

    $this->assertModelMissing($execution);
    Storage::disk('local')->assertMissing($path);
});

test('an administrator can download the original binary bytes without exposing base64 in the input review', function () {
    Storage::fake('local');
    $content = "\x00\xff\x01binary";
    $execution = app(CreateProcessExecution::class)->handle(
        user: User::factory()->create(),
        process: ['id' => 'binary-example'],
        payload: ['inputs' => ['input.data' => ['value' => base64_encode($content), 'encoding' => 'base64']]],
        mode: ExecutionMode::Async,
        inputFiles: [['path' => ['input.data'], 'name' => '../../sample.bin']],
    );
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->get(route('jobs.show', $execution))->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.inputs', fn ($inputs): bool => $inputs['input.data']['value'] === null)
        ->where('inputReview.files.0.name', 'sample.bin')
        ->has('execution.requestPayload'));
    $response = $this->get(route('jobs.inputs.download', [$execution, 0]));
    $response->assertDownload('sample.bin');
    expect($response->streamedContent())->toBe($content);
    Storage::disk('local')->assertExists($execution->input_snapshot['inputsPath']);
});

test('missing snapshot content is reported as unavailable and cannot be downloaded', function () {
    Storage::fake('local');
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'input_snapshot' => [
            'version' => 1,
            'fields' => ['data' => ['name' => 'data', 'title' => 'Data', 'kind' => 'scalar']],
            'inputs' => null,
            'inputsPath' => 'ogc/input-snapshots/missing.json',
            'files' => [['name' => 'data.csv', 'path' => ['data'], 'sizeBytes' => 10, 'mediaType' => 'text/csv']],
        ],
    ]);

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.legacy', false)
        ->where('inputReview.unavailableInputs', ['data'])
        ->where('inputReview.files.0.available', false)
        ->missing('inputReview.inputs.data'));
    $this->get(route('jobs.inputs.download', [$execution, 0]))->assertNotFound();
    Storage::disk('local')->assertMissing('ogc/input-snapshots/missing.json');
});

test('a genuine submitted string matching the old redaction marker is preserved in new snapshots', function () {
    $user = User::factory()->create();
    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: ['id' => 'marker-example'],
        payload: ['inputs' => ['text' => '[redacted inline value]']],
        mode: ExecutionMode::Async,
    );

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.inputs.text', '[redacted inline value]')
        ->where('inputReview.unavailableInputs', []));
});

test('input downloads require authentication and reject unknown file identifiers', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $this->get(route('jobs.inputs.download', [$execution, 0]))->assertRedirect(route('login'));
    $this->actingAs($user)->get(route('jobs.inputs.download', [$execution, 42]))->assertNotFound();
});

test('job status polling does not resend the immutable input review', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertInertia(fn (Assert $page) => $page
        ->has('inputReview')
        ->reloadOnly(['execution', 'pollingInterval'], fn (Assert $reload) => $reload
            ->missing('inputReview')
            ->where('execution.id', $execution->id)));
});

test('recoverable legacy binary inputs get an authorized download even without saved upload metadata', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'request_payload' => ['inputs' => ['data' => ['value' => base64_encode('original bytes'), 'encoding' => 'base64']]],
    ]);

    $this->actingAs($user)->get(route('jobs.show', $execution))->assertInertia(fn (Assert $page) => $page
        ->where('inputReview.files.0.available', true)
        ->where('inputReview.files.0.sizeBytes', 14));
    $response = $this->get(route('jobs.inputs.download', [$execution, 0]));
    $response->assertDownload('data.bin');
    expect($response->streamedContent())->toBe('original bytes');
});

test('JSON upload downloads retain the original file bytes even for scalar JSON documents', function (mixed $value, string $original) {
    Storage::fake('local');
    $user = User::factory()->create();
    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: ['id' => 'json-example'],
        payload: ['inputs' => ['data' => ['value' => $value, 'mediaType' => 'application/json']]],
        mode: ExecutionMode::Async,
        inputFiles: [['path' => ['data'], 'name' => 'original.json', 'content' => $original]],
    );

    $response = $this->actingAs($user)->get(route('jobs.inputs.download', [$execution, 0]));

    $response->assertDownload('original.json');
    expect($response->streamedContent())->toBe($original);
    Storage::disk('local')->assertExists($execution->input_snapshot['inputsPath']);
})->with([
    'number' => [42, " 42 \n"],
    'boolean' => [true, "true\n"],
    'null' => [null, "null\n"],
    'object formatting' => [['answer' => 42], "{ \"answer\": 42 }\n"],
]);

test('submitting a file retains its original content separately from the processing payload', function () {
    Storage::fake('local');
    Bus::fake([SubmitProcessExecutionJob::class]);
    $user = User::factory()->create();
    $content = "{ \"answer\": 42 }\n";
    $inputs = ['data' => ['value' => ['answer' => 42], 'mediaType' => 'application/json']];
    app(OgcProcessCache::class)->putProcess('json-upload', [
        'id' => 'json-upload',
        'inputs' => ['data' => ['schema' => ['type' => 'object', 'properties' => ['answer' => ['type' => 'integer']]]]],
    ]);

    $this->actingAs($user)->post(route('processes.jobs.store', 'json-upload'), [
        'inputs' => $inputs,
        'inputFiles' => [['path' => ['data'], 'name' => 'original.json', 'content' => base64_encode($content), 'encoding' => 'base64']],
        'outputs' => [],
    ])->assertRedirect()->assertSessionHasNoErrors();

    $execution = ProcessExecution::query()->sole();
    $response = $this->get(route('jobs.inputs.download', [$execution, 0]));
    $response->assertDownload('original.json');
    expect($response->streamedContent())->toBe($content);
    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->payload['inputs'] === $inputs && ! array_key_exists('inputFiles', $job->payload));
});

test('a storage failure prevents creating or dispatching an execution without its submitted inputs', function () {
    Bus::fake([SubmitProcessExecutionJob::class]);
    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('large-input', [
        'id' => 'large-input',
        'inputs' => ['data' => ['schema' => ['type' => 'string']]],
    ]);
    Storage::shouldReceive('disk->put')->once()->andReturn(false);
    $this->withoutExceptionHandling()->actingAs($user);

    expect(fn () => $this->post(route('processes.jobs.store', 'large-input'), [
        'inputs' => ['data' => str_repeat('x', 9000)],
        'outputs' => [],
    ]))->toThrow(RuntimeException::class, 'Unable to store the submitted input snapshot.');

    $this->assertDatabaseCount('process_executions', 0);
    Bus::assertNothingDispatched();
});

test('empty uploaded files retain a downloadable zero-byte snapshot after empty strings become null', function () {
    Storage::fake('local');
    $user = User::factory()->create();
    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: ['id' => 'empty-upload'],
        payload: ['inputs' => ['data' => ['value' => null, 'encoding' => 'base64']]],
        mode: ExecutionMode::Async,
        inputFiles: [['path' => ['data'], 'name' => 'empty.txt', 'content' => null, 'encoding' => 'base64']],
    );

    $response = $this->actingAs($user)->get(route('jobs.inputs.download', [$execution, 0]));

    $response->assertDownload('empty.txt');
    expect($response->streamedContent())->toBe('');
    expect($execution->input_snapshot['files'][0]['sizeBytes'])->toBe(0);
});
