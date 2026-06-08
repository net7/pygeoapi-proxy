<?php

namespace Database\Factories;

use App\Models\EmailOtpChallenge;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<EmailOtpChallenge>
 */
class EmailOtpChallengeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'email' => fake()->safeEmail(),
            'purpose' => EmailOtpChallenge::PurposeSocialLogin,
            'code_hash' => Hash::make('123456'),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'consumed_at' => null,
            'payload' => [],
        ];
    }
}
