<?php

namespace App\Support;

use Illuminate\Support\ConfigurationUrlParser;
use Throwable;

class SmtpDiagnostics
{
    /**
     * @var array<string, string>
     */
    private array $secrets = [];

    /**
     * @param  array<string, mixed>  $config
     */
    public function __construct(private readonly array $config)
    {
        $credentials = [$config['username'] ?? null, $config['password'] ?? null, $config['url'] ?? null];
        $url = parse_url((string) ($config['url'] ?? ''));

        if (is_array($url)) {
            $credentials[] = rawurldecode($url['user'] ?? '');
            $credentials[] = rawurldecode($url['pass'] ?? '');
            parse_str($url['query'] ?? '', $query);
            $credentials[] = $query['username'] ?? null;
            $credentials[] = $query['password'] ?? null;
        }

        foreach ($credentials as $credential) {
            if (! is_scalar($credential) || (string) $credential === '') {
                continue;
            }

            foreach ([(string) $credential, rawurlencode((string) $credential), urlencode((string) $credential), base64_encode((string) $credential)] as $secret) {
                $this->secrets[$secret] = '[REDACTED]';
            }
        }
    }

    /**
     * @return array<string, string|int|float|bool>
     */
    public function configuration(): array
    {
        $config = (new ConfigurationUrlParser)->parseConfiguration($this->config);
        $scheme = $config['scheme'] ?? (($config['port'] ?? null) == 465 ? 'smtps' : 'smtp');

        $details = [
            'transport' => $this->transport() ?? 'not configured',
            'scheme' => $scheme,
            'host' => $config['host'] ?? 'not configured',
            'port' => empty($config['port']) ? 'automatic' : $config['port'],
            'timeout' => $config['timeout'] ?? (float) ini_get('default_socket_timeout'),
            'local_domain' => $config['local_domain'] ?? '[127.0.0.1]',
            'auto_tls' => $config['auto_tls'] ?? true,
            'require_tls' => $config['require_tls'] ?? false,
            'verify_peer' => $config['verify_peer'] ?? true,
            'authentication' => empty($config['username']) ? 'not configured' : 'configured',
        ];

        return array_map(fn (mixed $value): mixed => is_string($value) ? $this->redact($value) : $value, $details);
    }

    public function transport(): ?string
    {
        if (isset($this->config['url'])) {
            return (new ConfigurationUrlParser)->parseConfiguration($this->config)['driver'] ?? null;
        }

        return $this->config['transport'] ?? null;
    }

    public function redact(string $text): string
    {
        $authenticating = false;
        $lines = explode("\n", str_replace("\r\n", "\n", $text));

        foreach ($lines as &$line) {
            if (preg_match('/^((?:\[[^\]]+\]\s*)?>\s*)(.*)$/', $line, $command)) {
                if (preg_match('/^AUTH\s+(\S+)(?:\s+(.+))?$/i', $command[2], $auth)) {
                    $authenticating = true;
                    if (isset($auth[2])) {
                        $this->secrets[$auth[2]] = '[REDACTED]';
                    }
                    $line = $command[1].'AUTH '.$auth[1].(isset($auth[2]) ? ' [REDACTED]' : '');
                } elseif (preg_match('/^(RSET|QUIT)\b/i', $command[2])) {
                    $authenticating = false;
                } elseif ($authenticating) {
                    if ($command[2] !== '') {
                        $this->secrets[$command[2]] = '[REDACTED]';
                    }
                    $line = $command[1].'[REDACTED]';
                }
            } elseif (preg_match('/^(?:\[[^\]]+\]\s*)?<\s*([245]\d{2})\b/', $line)) {
                $authenticating = false;
            }
        }
        unset($line);

        $text = strtr(implode("\n", $lines), $this->secrets);

        return preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/', '', $text) ?? '';
    }

    /**
     * @return list<array{type: class-string<Throwable>, code: int|string, message: string, file: string, line: int, trace: list<array<string, mixed>>}>
     */
    public function exceptions(Throwable $exception): array
    {
        $exceptions = [];

        do {
            $exceptions[] = [
                'type' => $exception::class,
                'code' => $exception->getCode(),
                'message' => $this->redact($exception->getMessage()),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => array_map(function (array $frame): array {
                    unset($frame['args'], $frame['object']);

                    return $frame;
                }, $exception->getTrace()),
            ];
        } while ($exception = $exception->getPrevious());

        return $exceptions;
    }
}
