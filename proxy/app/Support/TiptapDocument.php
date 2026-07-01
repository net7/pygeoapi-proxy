<?php

namespace App\Support;

class TiptapDocument
{
    public const MaxBytes = 65535;

    /**
     * @param  array<string, mixed>|null  $document
     * @return array{type: string, content?: list<array<string, mixed>>}|null
     */
    public static function sanitize(?array $document): ?array
    {
        if (($document['type'] ?? null) !== 'doc') {
            return null;
        }

        $content = self::sanitizeContent($document['content'] ?? []);
        $sanitized = ['type' => 'doc'];

        if ($content !== []) {
            $sanitized['content'] = $content;
        }

        return self::containsText($sanitized) ? $sanitized : null;
    }

    /**
     * @param  array<string, mixed>|null  $document
     */
    public static function byteLength(?array $document): int
    {
        $encoded = json_encode($document ?? [], JSON_THROW_ON_ERROR);

        return strlen($encoded);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function sanitizeContent(mixed $content): array
    {
        if (! is_array($content)) {
            return [];
        }

        return collect($content)
            ->map(fn (mixed $node): ?array => is_array($node) ? self::sanitizeNode($node) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $node
     * @return array<string, mixed>|null
     */
    private static function sanitizeNode(array $node): ?array
    {
        $type = $node['type'] ?? null;

        if ($type === 'text') {
            $text = (string) ($node['text'] ?? '');

            if ($text === '') {
                return null;
            }

            $sanitized = [
                'type' => 'text',
                'text' => $text,
            ];

            $marks = self::sanitizeMarks($node['marks'] ?? []);

            if ($marks !== []) {
                $sanitized['marks'] = $marks;
            }

            return $sanitized;
        }

        if ($type === 'hardBreak') {
            return ['type' => 'hardBreak'];
        }

        if (! in_array($type, ['paragraph', 'bulletList', 'orderedList', 'listItem', 'blockquote'], true)) {
            return null;
        }

        $sanitized = ['type' => $type];
        $content = self::sanitizeContent($node['content'] ?? []);

        if ($content !== []) {
            $sanitized['content'] = $content;
        }

        return $sanitized;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function sanitizeMarks(mixed $marks): array
    {
        if (! is_array($marks)) {
            return [];
        }

        return collect($marks)
            ->map(function (mixed $mark): ?array {
                if (! is_array($mark)) {
                    return null;
                }

                return match ($mark['type'] ?? null) {
                    'bold' => ['type' => 'bold'],
                    'italic' => ['type' => 'italic'],
                    'link' => self::sanitizeLinkMark($mark),
                    default => null,
                };
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $mark
     * @return array{type: string, attrs: array{href: string, target: string, rel: string}}|null
     */
    private static function sanitizeLinkMark(array $mark): ?array
    {
        $href = $mark['attrs']['href'] ?? null;

        if (! is_string($href)) {
            return null;
        }

        $href = trim($href);

        if ($href === '' || strlen($href) > 2048) {
            return null;
        }

        $scheme = parse_url($href, PHP_URL_SCHEME);

        if (! is_string($scheme) || ! in_array(strtolower($scheme), ['http', 'https', 'mailto'], true)) {
            return null;
        }

        return [
            'type' => 'link',
            'attrs' => [
                'href' => $href,
                'target' => '_blank',
                'rel' => 'noopener noreferrer nofollow',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function containsText(array $node): bool
    {
        if (($node['type'] ?? null) === 'text') {
            return trim((string) ($node['text'] ?? '')) !== '';
        }

        $content = $node['content'] ?? [];

        if (! is_array($content)) {
            return false;
        }

        foreach ($content as $child) {
            if (is_array($child) && self::containsText($child)) {
                return true;
            }
        }

        return false;
    }
}
