<?php

namespace Database\Factories;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProcessExecutionResult>
 */
class ProcessExecutionResultFactory extends Factory
{
    /**
     * Define the model's default state.
     *
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
