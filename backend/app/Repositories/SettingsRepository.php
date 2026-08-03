<?php

namespace App\Repositories;

use App\Models\Setting;
use Illuminate\Database\Eloquent\Model;

class SettingsRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new Setting;
    }

    public function allAsArray(): array
    {
        $settings = $this->model->newQuery()->pluck('value', 'key');

        $data = [];
        foreach (Setting::KEYS as $key) {
            $data[$key] = $settings->get($key);
        }

        return $data;
    }
}
