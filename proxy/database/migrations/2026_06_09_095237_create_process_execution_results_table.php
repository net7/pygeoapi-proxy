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
