<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ResultCollectionStatus;
use App\Jobs\Ogc\CollectProcessExecutionResultsJob;
use App\Models\ProcessExecution;

class RetryProcessExecutionResults
{
    public function handle(ProcessExecution $execution): void
    {
        $execution->update([
            'result_collection_status' => ResultCollectionStatus::Pending,
            'result_collection_error' => null,
        ]);

        CollectProcessExecutionResultsJob::dispatch($execution->id);
    }
}
