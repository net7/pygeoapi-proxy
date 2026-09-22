<?php

namespace App\Actions\Ogc;

use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use App\Services\Ogc\ProcessExecutionInputSnapshot;
use App\Services\Ogc\ProcessExecutionStorage;
use Illuminate\Http\Client\RequestException;

class DeleteProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private ProcessExecutionInputSnapshot $snapshots,
        private ProcessExecutionStorage $storage,
    ) {}

    public function handle(ProcessExecution $execution): void
    {
        if (filled($execution->remote_job_id)) {
            try {
                $this->client->deleteJob($execution->remote_job_id);
            } catch (RequestException $exception) {
                if ($exception->response->status() !== 404) {
                    throw $exception;
                }
            }
        }

        $this->storage->deleteResults($execution);
        $execution->delete();
        $this->snapshots->delete($execution->input_snapshot);
    }
}
