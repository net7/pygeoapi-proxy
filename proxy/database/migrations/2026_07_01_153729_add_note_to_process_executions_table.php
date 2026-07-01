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
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->json('note')->nullable()->after('message');
            $table->timestamp('note_updated_at')->nullable()->after('note');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->dropColumn(['note', 'note_updated_at']);
        });
    }
};
