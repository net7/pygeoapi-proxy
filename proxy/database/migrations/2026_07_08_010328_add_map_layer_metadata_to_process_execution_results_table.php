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
        Schema::table('process_execution_results', function (Blueprint $table) {
            $table->string('map_layer_status')->nullable()->after('preview');
            $table->string('map_layer_type')->nullable()->after('map_layer_status');
            $table->string('map_layer_name')->nullable()->after('map_layer_type');
            $table->string('map_style_name')->nullable()->after('map_layer_name');
            $table->json('map_layer_bounds')->nullable()->after('map_style_name');
            $table->text('map_layer_error')->nullable()->after('map_layer_bounds');
            $table->timestamp('map_layer_published_at')->nullable()->after('map_layer_error');

            $table->index(['process_execution_id', 'map_layer_status'], 'process_results_execution_map_status_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('process_execution_results', function (Blueprint $table) {
            $table->dropIndex('process_results_execution_map_status_index');
            $table->dropColumn([
                'map_layer_status',
                'map_layer_type',
                'map_layer_name',
                'map_style_name',
                'map_layer_bounds',
                'map_layer_error',
                'map_layer_published_at',
            ]);
        });
    }
};
