<?php

namespace App\Enums\Ogc;

enum ExecutionStatus: string
{
    case Submitting = 'submitting';
    case Accepted = 'accepted';
    case Running = 'running';
    case Successful = 'successful';
    case Failed = 'failed';
    case SubmissionFailed = 'submission_failed';
    case RemoteMissing = 'remote_missing';

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Successful,
            self::Failed,
            self::SubmissionFailed,
            self::RemoteMissing,
        ], true);
    }
}
