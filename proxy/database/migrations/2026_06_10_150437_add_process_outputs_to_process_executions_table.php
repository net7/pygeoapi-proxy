<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->json('process_outputs')->nullable()->after('requested_outputs');
        });
    }

    public function down(): void
    {
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->dropColumn('process_outputs');
        });
    }
};
