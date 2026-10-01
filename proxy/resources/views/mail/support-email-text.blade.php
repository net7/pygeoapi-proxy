{!! __('Support request') !!}

{!! __('Contact email') !!}: {!! $data->replyTo !!}
{!! __('Submitted at') !!}: {!! date('c', $data->acceptedAt) !!}
@if ($data->account !== null)
{!! __('Authenticated account') !!}: {!! $data->account['name'] !!} ({!! $data->account['email'] !!}, #{!! $data->account['id'] !!})
@else
{!! __('Submitted without signing in.') !!}
@endif

{!! $data->description !!}
