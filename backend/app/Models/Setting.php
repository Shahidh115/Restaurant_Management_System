<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public const KEYS = [
        'restaurant_name',
        'logo_path',
        'address',
        'phone',
        'receipt_header',
        'receipt_footer',
        'currency',
        'tax_rate',
        'printer_config',
        'invoice_prefix',
    ];

    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::query()->where('key', $key)->first();

        return $setting?->value ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }
}
