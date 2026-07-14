<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileAvatarUpdateRequest;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Profile updated'),
            'message' => __('Profile updated.'),
            'description' => __('Your account details are now up to date.'),
        ]);

        return to_route('profile.edit');
    }

    /**
     * Serve the user's profile avatar.
     */
    public function showAvatar(Request $request, string $path): BinaryFileResponse
    {
        $canViewAvatar = $request->user()->avatar_path === $path
            || ($request->user()->isAdmin() && User::query()->where('avatar_path', $path)->exists());

        abort_unless($canViewAvatar, 404);
        abort_unless(Storage::disk('public')->exists($path), 404);

        return response()->file(Storage::disk('public')->path($path));
    }

    /**
     * Update the user's profile avatar.
     */
    public function updateAvatar(ProfileAvatarUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $previousAvatarPath = $user->avatar_path;
        $avatarPath = $request->file('avatar')->store('avatars', 'public');

        abort_if($avatarPath === false, 500);

        $user->forceFill(['avatar_path' => $avatarPath])->save();

        if ($previousAvatarPath !== null) {
            Storage::disk('public')->delete($previousAvatarPath);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Avatar updated'),
            'message' => __('Avatar updated.'),
            'description' => __('Your profile image has been refreshed.'),
        ]);

        return to_route('profile.edit');
    }

    /**
     * Remove the user's profile avatar.
     */
    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->avatar_path !== null) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Avatar removed'),
            'message' => __('Avatar removed.'),
            'description' => __('Your profile now uses the default account initials.'),
        ]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        abort_unless(AuthFeatures::enabled(AuthFeatures::accountDeletion()), 404);

        $user = $request->user();

        Auth::logout();

        if ($user->avatar_path !== null) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $user->delete();

        $request->session()->forget('auth.email_otp_confirmed_at');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
