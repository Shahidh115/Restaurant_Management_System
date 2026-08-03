<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyProduction extends Model
{
    protected $table = 'daily_production';

    protected $fillable = [
        'date',
        'production_resource_id',
        'opening_quantity',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'opening_quantity' => 'decimal:3',
        ];
    }

    public function setDateAttribute($value): void
    {
        $this->attributes['date'] = $value ? \Illuminate\Support\Carbon::parse($value)->toDateString() : null;
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(ProductionResource::class, 'production_resource_id');
    }
}
