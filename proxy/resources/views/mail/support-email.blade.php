<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head><meta charset="utf-8"><title>{{ __('Support request') }}</title></head>
<body>
    <h1>{{ __('Support request') }}</h1>
    <p><strong>{{ __('Contact email') }}:</strong> {{ $data->replyTo }}</p>
    <p><strong>{{ __('Submitted at') }}:</strong> {{ date('c', $data->acceptedAt) }}</p>
    @if ($data->account !== null)
        <p><strong>{{ __('Authenticated account') }}:</strong>
            {{ $data->account['name'] }} ({{ $data->account['email'] }}, #{{ $data->account['id'] }})
        </p>
    @else
        <p>{{ __('Submitted without signing in.') }}</p>
    @endif
    <hr>
    <div style="white-space: pre-wrap">{{ $data->description }}</div>
</body>
</html>
