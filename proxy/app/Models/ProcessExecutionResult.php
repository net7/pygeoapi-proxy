<?php

namespace App\Models;

use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use Database\Factories\ProcessExecutionResultFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'process_execution_id',
    'output_id',
    'title',
    'description',
    'media_type',
    'transmission_mode',
    'remote_href',
    'storage_path',
    'size_bytes',
    'cache_status',
    'preview',
    'map_layer_status',
    'map_layer_type',
    'map_layer_name',
    'map_style_name',
    'map_layer_bounds',
    'map_layer_error',
    'map_layer_published_at',
])]
class ProcessExecutionResult extends Model
{
    /** @use HasFactory<ProcessExecutionResultFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<ProcessExecution, ProcessExecutionResult>
     */
    public function processExecution(): BelongsTo
    {
        return $this->belongsTo(ProcessExecution::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cache_status' => ResultCacheStatus::class,
            'preview' => 'array',
            'map_layer_status' => MapLayerStatus::class,
            'map_layer_bounds' => 'array',
            'map_layer_published_at' => 'datetime',
        ];
    }
}
