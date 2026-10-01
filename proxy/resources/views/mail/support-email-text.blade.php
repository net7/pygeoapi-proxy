+--------+
| >_     |
+--------+
   _||_

{!! config('app.name') !!} / {!! __('Support request') !!}
----------------------------------------
{!! $data->subject !!}

{!! __('Contact email') !!}: {!! $data->replyTo !!}
{!! __('Submitted at') !!}: {!! date('c', $data->acceptedAt) !!}
@if ($data->account !== null)
{!! __('Authenticated account') !!}: {!! $data->account['name'] !!} ({!! $data->account['email'] !!}, #{!! $data->account['id'] !!})
@else
{!! __('Submitted without signing in.') !!}
@endif

[ {!! __('Request details') !!} ]
{!! $data->description !!}

@if (count($data->attachments) > 0)
[ {!! __('Attachments') !!} ({!! count($data->attachments) !!}) ]
@foreach ($data->attachments as $attachment)
+-- {!! $attachment['name'] !!}
@endforeach
@endif

----------------------------------------
[ {!! __('Technical context') !!} ]
{!! __('Technical information collected at submission, solely to diagnose and resolve this issue.') !!}
@forelse ($technicalDetails as $label => $value)
{!! $label !!}: {!! $value !!}
@empty
{!! __('Technical details were not available.') !!}
@endforelse
@if ($technicalDetails !== [])

{!! __('Browser-reported information may be limited or approximate.') !!}
@endif

----------------------------------------
> {!! __('Reply to this email to contact the requester at the address they provided.') !!}
