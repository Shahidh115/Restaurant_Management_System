<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Waste extends Model
{
    public const TYPE_BURNT = 'BURNT';
    public const TYPE_SPOILED = 'SPOILED';
    public const TYPE_STAFF_MEAL = 'STAFF_MEAL';
    public const TYPE_DAMAGED = 'DAMAGED';
    public const TYPE_MANUAL = 'MANUAL';

    public const TYPES = [
        self::TYPE_BURNT,
        self::TYPE_SPOILED,
        self::TYPE_STAFF_MEAL,
        self::TYPE_DAMAGED,
        self::TYPE_MANUAL,
    ];

    protected $fillable = [
        'production_resource_id',
        'type',
        'quantity',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(ProductionResource::class, 'production_resource_id');
    }
}
