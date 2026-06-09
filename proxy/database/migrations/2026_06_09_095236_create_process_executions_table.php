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
