<?php

namespace Database\Factories;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProcessExecution>
 */
class ProcessExecutionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
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
