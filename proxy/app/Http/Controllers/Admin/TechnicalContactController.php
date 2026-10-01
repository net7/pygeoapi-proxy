<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignTechnicalContactRequest;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TechnicalContactController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(AssignTechnicalContactRequest $request, User $user, SupportContactManager $contacts): RedirectResponse
    {
        $contacts->assign($user->id);
        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Technical contact appointed'),
            'message' => __('Support emails will be sent to the appointed administrator.'),
        ]);

        return to_route('admin.users.index');
    }
}
