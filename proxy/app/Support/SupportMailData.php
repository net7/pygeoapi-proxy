<?php

namespace App\Support;

readonly class SupportMailData
{
    /**
     * @param  array{id:int,name:string,email:string}|null  $account
     * @param  list<array{path:string,name:string,mime:string}>  $attachments
     */
    public function __construct(
        public string $id,
        public string $subject,
        public string $description,
        public string $replyTo,
        public int $acceptedAt,
        public int $expiresAt,
        public ?array $account,
        public array $attachments,
    ) {}
}
