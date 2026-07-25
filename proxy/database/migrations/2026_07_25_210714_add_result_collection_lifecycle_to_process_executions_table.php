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
            $table->string('result_collection_status')->nullable()->after('status');
            $table->text('result_collection_error')->nullable()->after('result_collection_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('process_executions', function (Blueprint $table) {
            $table->dropColumn([
                'result_collection_status',
                'result_collection_error',
            ]);
        });
    }
};
