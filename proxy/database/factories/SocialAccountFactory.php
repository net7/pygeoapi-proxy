<?php

namespace Database\Factories;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialAccount>
 */
class SocialAccountFactory extends Factory
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
            'provider' => 'google',
            'provider_user_id' => fake()->uuid(),
            'provider_email' => fake()->safeEmail(),
            'provider_email_verified' => true,
            'name' => fake()->name(),
            'avatar' => null,
            'raw_profile' => ['id' => fake()->uuid()],
        ];
    }
}
