<?php

namespace App\Http\Controllers\Ogc;

use App\Actions\Ogc\RetryProcessExecutionResults;
use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\ResultCollectionStatus;
use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class ProcessExecutionResultCollectionController extends Controller
{
    public function __invoke(
        ProcessExecution $processExecution,
        RetryProcessExecutionResults $retryProcessExecutionResults,
    ): RedirectResponse {
        Gate::authorize('view', $processExecution);

        abort_unless(
            $processExecution->status === ExecutionStatus::Successful
            && $processExecution->result_collection_status === ResultCollectionStatus::Failed,
            409,
        );

        $retryProcessExecutionResults->handle($processExecution);

        return to_route('jobs.show', $processExecution);
    }
}
