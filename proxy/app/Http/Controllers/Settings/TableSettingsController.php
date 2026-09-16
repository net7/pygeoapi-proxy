<?php

namespace App\Http\Controllers\Settings;

use App\Enums\TableKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateTableSettingsRequest;
use App\Support\UserTableSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableSettingsController extends Controller
{
    public function __construct(private UserTableSettings $settings) {}

    public function update(UpdateTableSettingsRequest $request, string $table): JsonResponse
    {
        return response()->json([
            'settings' => $this->settings->update($request->user(), TableKey::from($table), $request->validated()),
        ]);
    }

    public function destroy(Request $request, string $table): JsonResponse
    {
        return response()->json([
            'settings' => $this->settings->reset($request->user(), TableKey::from($table)),
        ]);
    }
}
