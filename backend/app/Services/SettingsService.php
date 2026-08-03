<?php

namespace App\Services;

use App\Models\Setting;
use App\Repositories\SettingsRepository;
use Illuminate\Support\Facades\Storage;

class SettingsService
{
    public function __construct(private readonly SettingsRepository $settings)
    {
    }

    public function all(): array
    {
        return $this->settings->allAsArray();
    }

    public function update(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array($key, Setting::KEYS, true)) {
                Setting::set($key, $value);
            }
        }

        return $this->all();
    }

    public function uploadLogo($file): string
    {
        $path = $file->store('settings', 'public');
        Setting::set('logo_path', $path);

        return $path;
    }
}
