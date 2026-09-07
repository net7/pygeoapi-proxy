<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('process_executions', function (Blueprint $table) {
            $table->json('input_snapshot')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('process_executions', function (Blueprint $table) {
            $table->dropColumn('input_snapshot');
        });
    }
};
