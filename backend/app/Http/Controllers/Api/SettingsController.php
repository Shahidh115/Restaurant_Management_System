<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\SettingsService;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $service)
    {
    }

    public function index()
    {
        return ApiResponse::success($this->service->all());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'restaurant_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:50'],
            'receipt_header' => ['nullable', 'string', 'max:500'],
            'receipt_footer' => ['nullable', 'string', 'max:500'],
            'currency' => ['nullable', 'string', 'max:10'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'printer_config' => ['nullable', 'string', 'max:2000'],
            'invoice_prefix' => ['nullable', 'string', 'max:10'],
        ]);

        return ApiResponse::success($this->service->update($data), 'Settings updated.');
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:4096'],
        ]);

        $path = $this->service->uploadLogo($request->file('logo'));

        return ApiResponse::success([
            'logo_path' => $path,
            'logo_url' => url('storage/'.$path),
        ], 'Logo uploaded.');
    }
}
