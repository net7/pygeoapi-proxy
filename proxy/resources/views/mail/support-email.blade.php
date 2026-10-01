<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>{{ __('Support request') }}</title>
    <style>
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        @media (prefers-color-scheme: dark) {
            .terminal-page { background-color: #101713 !important; }
            .terminal-surface { background-color: #18221c !important; }
            .terminal-panel { background-color: #202d24 !important; }
            .terminal-text { color: #e0e8e2 !important; }
            .terminal-muted { color: #a1b2a6 !important; }
            .terminal-accent { color: #91c6a1 !important; }
            .terminal-border { border-color: #3c4c41 !important; }
        }

        [data-ogsb] .terminal-page { background-color: #101713 !important; }
        [data-ogsb] .terminal-surface { background-color: #18221c !important; }
        [data-ogsb] .terminal-panel { background-color: #202d24 !important; }
        [data-ogsc] .terminal-text { color: #e0e8e2 !important; }
        [data-ogsc] .terminal-muted { color: #a1b2a6 !important; }
        [data-ogsc] .terminal-accent { color: #91c6a1 !important; }
        [data-ogsc] .terminal-border { border-color: #3c4c41 !important; }

        @media only screen and (max-width: 480px) {
            .terminal-outer { padding: 12px 8px !important; }
            .terminal-padding { padding: 20px 16px !important; }
            .terminal-section { padding: 0 16px 20px !important; }
            .terminal-key { display: block !important; width: auto !important; padding: 8px 0 2px !important; }
            .terminal-value { display: block !important; padding: 0 0 8px !important; }
        }
    </style>
</head>
<body class="terminal-page terminal-text" style="margin: 0; padding: 0; background-color: #edf0ee; color: #1e2823; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; -webkit-text-size-adjust: 100%;">
    <table class="terminal-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #edf0ee; table-layout: fixed;">
        <tr>
            <td class="terminal-outer" align="center" style="padding: 32px 12px;">
                <table class="terminal-surface terminal-text terminal-border" role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 640px; table-layout: fixed; background-color: #fcfdfb; color: #1e2823; border: 1px solid #ccd5cf; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 22px;">
                    <tr>
                        <td class="terminal-padding terminal-border" style="padding: 24px; border-bottom: 1px solid #ccd5cf;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout: fixed; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;">
                                <tr>
                                    <td width="88" valign="middle">
                                        <pre class="terminal-accent" aria-hidden="true" style="margin: 0; color: #236343; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 11px; line-height: 14px; white-space: pre;">+--------+
| &gt;_     |
+--------+
   _||_</pre>
                                    </td>
                                    <td valign="middle" style="overflow-wrap: anywhere; word-break: break-word;">
                                        <p class="terminal-muted" style="margin: 0 0 4px; color: #526459; font-size: 11px; line-height: 18px;">{{ config('app.name') }}</p>
                                        <h1 class="terminal-text" style="margin: 0; color: #1e2823; font-size: 20px; line-height: 28px; font-weight: 700;">{{ __('Support request') }}</h1>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td class="terminal-padding" style="padding: 24px;">
                            <h2 class="terminal-text" style="margin: 0 0 20px; color: #1e2823; font-size: 18px; line-height: 27px; font-weight: 700; overflow-wrap: anywhere; word-break: break-word;">{{ $data->subject }}</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout: fixed; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 20px;">
                                <tr>
                                    <td class="terminal-key terminal-muted" width="34%" valign="top" style="padding: 0 12px 8px 0; color: #526459;">{{ __('Contact email') }}</td>
                                    <td class="terminal-value" valign="top" style="padding: 0 0 8px; overflow-wrap: anywhere; word-break: break-word;">
                                        <a class="terminal-accent" href="mailto:{{ rawurlencode($data->replyTo) }}" style="color: #236343; text-decoration: underline;">{{ $data->replyTo }}</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="terminal-key terminal-muted" width="34%" valign="top" style="padding: 0 12px 8px 0; color: #526459;">{{ __('Submitted at') }}</td>
                                    <td class="terminal-value terminal-text" valign="top" style="padding: 0 0 8px; color: #1e2823; overflow-wrap: anywhere; word-break: break-word;">{{ date('c', $data->acceptedAt) }}</td>
                                </tr>
                                @if ($data->account !== null)
                                    <tr>
                                        <td class="terminal-key terminal-muted" width="34%" valign="top" style="padding: 0 12px 0 0; color: #526459;">{{ __('Authenticated account') }}</td>
                                        <td class="terminal-value terminal-text" valign="top" style="color: #1e2823; overflow-wrap: anywhere; word-break: break-word;">{{ $data->account['name'] }}<br>{{ $data->account['email'] }} / #{{ $data->account['id'] }}</td>
                                    </tr>
                                @else
                                    <tr>
                                        <td class="terminal-muted" colspan="2" style="padding: 4px 0 0; color: #526459;">{{ __('Submitted without signing in.') }}</td>
                                    </tr>
                                @endif
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td class="terminal-section" style="padding: 0 24px 24px;">
                            <h2 class="terminal-accent" style="margin: 0 0 12px; color: #236343; font-size: 13px; line-height: 22px; font-weight: 700;"><span aria-hidden="true">[ </span>{{ __('Request details') }}<span aria-hidden="true"> ]</span></h2>
                            <div class="terminal-panel terminal-text terminal-border" style="margin: 0; padding: 16px; border: 1px solid #ccd5cf; background-color: #f0f4f1; color: #1e2823; font-size: 13px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">{{ $data->description }}</div>
                        </td>
                    </tr>
                    @if (count($data->attachments) > 0)
                        <tr>
                            <td class="terminal-section" style="padding: 0 24px 24px;">
                                <h2 class="terminal-accent" style="margin: 0 0 10px; color: #236343; font-size: 13px; line-height: 22px; font-weight: 700;"><span aria-hidden="true">[ </span>{{ __('Attachments') }} ({{ count($data->attachments) }})<span aria-hidden="true"> ]</span></h2>
                                @foreach ($data->attachments as $attachment)
                                    <p class="terminal-text" style="margin: 0 0 4px; color: #1e2823; font-size: 12px; line-height: 20px; overflow-wrap: anywhere; word-break: break-word;"><span class="terminal-muted" aria-hidden="true" style="color: #526459;">+-- </span>{{ $attachment['name'] }}</p>
                                @endforeach
                            </td>
                        </tr>
                    @endif
                    <tr>
                        <td class="terminal-padding terminal-border" style="padding: 24px; border-top: 1px dashed #ccd5cf;">
                            <h2 class="terminal-accent" style="margin: 0 0 8px; color: #236343; font-size: 13px; line-height: 22px; font-weight: 700;"><span aria-hidden="true">[ </span>{{ __('Technical context') }}<span aria-hidden="true"> ]</span></h2>
                            <p class="terminal-muted" style="margin: 0 0 16px; color: #526459; font-size: 11px; line-height: 18px;">{{ __('Technical information collected at submission, solely to diagnose and resolve this issue.') }}</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout: fixed; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 20px;">
                                @forelse ($technicalDetails as $label => $value)
                                    <tr>
                                        <td class="terminal-key terminal-muted" width="34%" valign="top" style="padding: 0 12px 8px 0; color: #526459; overflow-wrap: anywhere; word-break: break-word;">{{ $label }}</td>
                                        <td class="terminal-value terminal-text" valign="top" style="padding: 0 0 8px; color: #1e2823; overflow-wrap: anywhere; word-break: break-word;">{{ $value }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td class="terminal-muted" style="color: #526459;">{{ __('Technical details were not available.') }}</td>
                                    </tr>
                                @endforelse
                            </table>
                            @if ($technicalDetails !== [])
                                <p class="terminal-muted" style="margin: 12px 0 0; color: #526459; font-size: 11px; line-height: 18px;">{{ __('Browser-reported information may be limited or approximate.') }}</p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td class="terminal-padding terminal-border" style="padding: 20px 24px; border-top: 1px dashed #ccd5cf;">
                            <p class="terminal-muted" style="margin: 0; color: #526459; font-size: 11px; line-height: 18px;"><span class="terminal-accent" aria-hidden="true" style="color: #236343;">&gt; </span>{{ __('Reply to this email to contact the requester at the address they provided.') }}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
