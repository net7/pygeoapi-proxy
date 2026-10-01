<?php

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->from('/login');
    config(['support.allow_guests' => true, 'queue.default' => 'database']);
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    Queue::fake();
    Storage::fake('local');
});

test('office attachments are accepted using detected content instead of the browser mime', function (string $extension) {
    $format = strtolower($extension);
    $contents = in_array($format, ['docx', 'xlsx', 'pptx'], true)
        ? supportOpenXmlFixture($format)
        : supportCompoundOfficeFixture($format);
    $name = 'document.'.$extension;
    $fixture = UploadedFile::fake()->createWithContent($name, $contents);
    $file = new UploadedFile($fixture->getPathname(), $name, 'application/octet-stream', null, true);

    $this->post('/support', [
        'subject' => 'Office attachment', 'description' => 'A document with the reported problem.',
        'email' => 'guest@example.org', 'attachments' => [$file],
    ])->assertRedirect('/login')->assertSessionHasNoErrors();

    Queue::assertPushed(SendSupportEmail::class, fn (SendSupportEmail $job): bool => count($job->data->attachments) === 1
        && $job->data->attachments[0]['name'] === 'document.'.$format
        && Storage::disk('local')->get($job->data->attachments[0]['path']) === $contents
    );
})->with(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'XLSX']);

test('renamed text executable zip and mismatched office documents are rejected', function (string $name, string $kind) {
    $contents = match ($kind) {
        'text' => 'This is not an Office document.',
        'executable' => 'MZ'.str_repeat("\0", 200),
        'zip' => supportOfficeZipFixture(['notes.txt' => 'ordinary archive']),
        'word' => supportOpenXmlFixture('docx'),
        'broken' => "PK\x03\x04".str_repeat("\0", 100),
    };
    $fixture = UploadedFile::fake()->createWithContent($name, $contents);
    $file = new UploadedFile($fixture->getPathname(), $name, 'application/vnd.ms-excel', null, true);

    $this->postJson('/support', [
        'subject' => 'Office attachment', 'description' => 'A document with the reported problem.',
        'email' => 'guest@example.org', 'attachments' => [$file],
    ])->assertUnprocessable()->assertJsonValidationErrors('attachments.0');

    Queue::assertNothingPushed();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([
    ['fake.doc', 'text'], ['fake.xls', 'executable'], ['fake.ppt', 'zip'],
    ['fake.docx', 'zip'], ['fake.xlsx', 'zip'], ['fake.pptx', 'zip'],
    ['renamed.xlsx', 'word'], ['renamed.pptx', 'word'], ['archive.zip', 'word'],
    ['broken.docx', 'broken'],
]);

function supportOpenXmlFixture(string $extension): string
{
    [$part, $type, $xml] = match ($extension) {
        'docx' => ['word/document.xml', 'wordprocessingml.document', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Support test</w:t></w:r></w:p></w:body></w:document>'],
        'xlsx' => ['xl/workbook.xml', 'spreadsheetml.sheet', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'],
        'pptx' => ['ppt/presentation.xml', 'presentationml.presentation', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'],
    };

    return supportOfficeZipFixture([
        '[Content_Types].xml' => '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/'.$part.'" ContentType="application/vnd.openxmlformats-officedocument.'.$type.'.main+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="'.$part.'"/></Relationships>',
        $part => $xml,
    ]);
}

/** @param array<string, string> $entries */
function supportOfficeZipFixture(array $entries): string
{
    $path = tempnam(sys_get_temp_dir(), 'support-office-');
    $zip = new ZipArchive;
    try {
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Cannot create the synthetic Office fixture.');
        }
        foreach ($entries as $name => $contents) {
            $zip->addFromString($name, $contents);
        }
        $zip->close();

        return file_get_contents($path);
    } finally {
        unlink($path);
    }
}

/** Build a small Compound File Binary v3 container with one format-specific stream. */
function supportCompoundOfficeFixture(string $extension): string
{
    [$streamName, $streamStart] = match ($extension) {
        'doc' => ['WordDocument', pack('v2', 0xA5EC, 0x00C1)],
        'xls' => ['Workbook', pack('v4', 0x0809, 16, 0x0600, 0x0005)],
        'ppt' => ['PowerPoint Document', pack('vvV', 0x000F, 0x03E8, 0)],
    };
    $free = 0xFFFFFFFF;
    $end = 0xFFFFFFFE;
    $header = "\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1".str_repeat("\0", 16)
        .pack('v5', 0x003E, 3, 0xFFFE, 9, 6).str_repeat("\0", 6)
        .pack('V9', 0, 1, 1, 0, 4096, $end, 0, $end, 0)
        .pack('V', 0).str_repeat(pack('V', $free), 108);
    $fat = pack('V*', 0xFFFFFFFD, $end, 3, 4, 5, 6, 7, 8, 9, $end)
        .str_repeat(pack('V', $free), 118);
    $entry = function (string $name, int $type, int $child, int $start, int $size) use ($free): string {
        $encoded = mb_convert_encoding($name."\0", 'UTF-16LE', 'UTF-8');

        return str_pad($encoded, 64, "\0")
            .pack('vCCVVV', strlen($encoded), $type, 1, $free, $free, $child)
            .str_repeat("\0", 36).pack('V3', $start, $size, 0);
    };
    $directory = $entry('Root Entry', 5, 1, $end, 0)
        .$entry($streamName, 2, $free, 2, 4096).str_repeat("\0", 256);

    return $header.$fat.$directory.str_pad($streamStart, 4096, "\0");
}
