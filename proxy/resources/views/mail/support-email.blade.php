<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('Support request') }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f5f7; color: #203540; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f5f7;">
        <tr>
            <td align="center" style="padding: 24px 12px;">
                <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 640px; background-color: #ffffff; border: 1px solid #d5e2e8; border-radius: 12px; overflow: hidden;">
                    <tr>
                        <td style="padding: 28px 24px; background-color: #24556a; color: #ffffff;">
                            <p style="margin: 0 0 12px; font-size: 13px; line-height: 20px; color: #d9ebf2;">{{ config('app.name') }}</p>
                            <h1 style="margin: 0; font-size: 24px; line-height: 32px; font-weight: 600;"><span aria-hidden="true">🛟</span> {{ __('Support request') }}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px;">
                            <h2 style="margin: 0 0 20px; font-size: 21px; line-height: 30px; overflow-wrap: anywhere; word-break: break-word;">{{ $data->subject }}</h2>
                            <p style="margin: 0 0 5px; font-size: 12px; line-height: 18px; color: #5c7180;">{{ __('Contact email') }}</p>
                            <p style="margin: 0 0 16px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 14px; line-height: 22px; overflow-wrap: anywhere; word-break: break-word;">
                                <a href="mailto:{{ rawurlencode($data->replyTo) }}" style="color: #24556a; text-decoration: underline;">{{ $data->replyTo }}</a>
                            </p>
                            <p style="margin: 0 0 4px; font-size: 12px; line-height: 18px; color: #5c7180;">{{ __('Submitted at') }}</p>
                            <p style="margin: 0 0 16px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 21px;">{{ date('c', $data->acceptedAt) }}</p>
                            @if ($data->account !== null)
                                <p style="margin: 0 0 4px; font-size: 12px; line-height: 18px; color: #5c7180;">{{ __('Authenticated account') }}</p>
                                <p style="margin: 0; font-size: 14px; line-height: 22px; overflow-wrap: anywhere; word-break: break-word;">{{ $data->account['name'] }}<br>
                                    <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px;">{{ $data->account['email'] }} · #{{ $data->account['id'] }}</span>
                                </p>
                            @else
                                <p style="margin: 0; font-size: 13px; line-height: 21px; color: #5c7180;">{{ __('Submitted without signing in.') }}</p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 24px;">
                            <h2 style="margin: 0 0 12px; font-size: 16px; line-height: 24px;">{{ __('Request details') }}</h2>
                            <div style="margin: 0; padding: 16px; border-left: 3px solid #24556a; background-color: #f3f7f9; color: #203540; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">{{ $data->description }}</div>
                        </td>
                    </tr>
                    @if (count($data->attachments) > 0)
                        <tr>
                            <td style="padding: 0 24px 24px;">
                                <h2 style="margin: 0 0 10px; font-size: 16px; line-height: 24px;"><span aria-hidden="true">📎</span> {{ __('Attachments') }} ({{ count($data->attachments) }})</h2>
                                @foreach ($data->attachments as $attachment)
                                    <p style="margin: 0 0 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 20px; overflow-wrap: anywhere; word-break: break-word;">{{ $attachment['name'] }}</p>
                                @endforeach
                            </td>
                        </tr>
                    @endif
                    <tr>
                        <td style="padding: 24px; border-top: 1px solid #d5e2e8;">
                            <h2 style="margin: 0 0 8px; font-size: 16px; line-height: 24px;"><span aria-hidden="true">🖥️</span> {{ __('Technical context') }}</h2>
                            <p style="margin: 0 0 16px; font-size: 12px; line-height: 20px; color: #5c7180;">{{ __('Technical information collected at submission, solely to diagnose and resolve this issue.') }}</p>
                            @forelse ($technicalDetails as $label => $value)
                                <p style="margin: 14px 0 3px; font-size: 12px; line-height: 18px; color: #5c7180;">{{ $label }}</p>
                                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px; line-height: 20px; overflow-wrap: anywhere; word-break: break-word;">{{ $value }}</div>
                            @empty
                                <p style="margin: 0; font-size: 13px; line-height: 21px; color: #5c7180;">{{ __('Technical details were not available.') }}</p>
                            @endforelse
                            @if ($technicalDetails !== [])
                                <p style="margin: 16px 0 0; font-size: 11px; line-height: 18px; color: #5c7180;">{{ __('Browser-reported information may be limited or approximate.') }}</p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 24px; background-color: #f3f7f9; border-top: 1px solid #d5e2e8;">
                            <p style="margin: 0; font-size: 13px; line-height: 21px; color: #405c6b;">{{ __('Reply to this email to contact the requester at the address they provided.') }}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
