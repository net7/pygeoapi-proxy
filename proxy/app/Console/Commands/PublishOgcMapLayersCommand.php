<?php

namespace App\Console\Commands;

use App\Actions\Ogc\FindGeoTiffSldResultPairs;
use App\Enums\Ogc\MapLayerStatus;
use App\Jobs\Ogc\PublishGeoTiffMapLayerJob;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('ogc:publish-map-layers {execution? : Optional process execution id} {--failed : Requeue failed publications} {--all : Requeue pending and unpublished publications for all executions}')]
#[Description('Publish cached GeoTIFF and SLD process results as GeoServer map layers')]
class PublishOgcMapLayersCommand extends Command
{
    public function handle(FindGeoTiffSldResultPairs $findGeoTiffSldResultPairs): int
    {
        $executionId = $this->argument('execution');

        if ($executionId === null && ! (bool) $this->option('all')) {
            $this->error('Provide a process execution id or pass --all.');

            return self::FAILURE;
        }

        $query = ProcessExecution::query()->with('results');

        if ($executionId !== null) {
            $query->whereKey((int) $executionId);
        }

        $dispatched = 0;

        $query->chunkById(100, function ($executions) use ($findGeoTiffSldResultPairs, &$dispatched): void {
            foreach ($executions as $execution) {
                foreach ($findGeoTiffSldResultPairs->handle($execution) as $pair) {
                    $geotiff = $pair['geotiff'];

                    if (! $this->shouldDispatch($geotiff)) {
                        continue;
                    }

                    $geotiff->update([
                        'map_layer_status' => MapLayerStatus::Pending,
                        'map_layer_type' => 'wms',
                        'map_layer_error' => null,
                    ]);

                    PublishGeoTiffMapLayerJob::dispatch($execution->id, $geotiff->id, $pair['sld']->id);
                    $dispatched++;
                }
            }
        });

        $this->info(sprintf(
            'Dispatched %d map layer publication %s.',
            $dispatched,
            $dispatched === 1 ? 'job' : 'jobs',
        ));

        return self::SUCCESS;
    }

    private function shouldDispatch(ProcessExecutionResult $geotiff): bool
    {
        if (in_array($geotiff->map_layer_status, [
            MapLayerStatus::Pending,
            MapLayerStatus::Publishing,
            MapLayerStatus::Published,
        ], true)) {
            return false;
        }

        if ($geotiff->map_layer_status === MapLayerStatus::Failed) {
            return (bool) $this->option('failed');
        }

        return true;
    }
}
