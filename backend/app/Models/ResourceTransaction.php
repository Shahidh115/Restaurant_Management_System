<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResourceTransaction extends Model
{
    public const TYPE_OPENING = 'OPENING';
    public const TYPE_PRODUCTION = 'PRODUCTION';
    public const TYPE_SALE = 'SALE';
    public const TYPE_SALE_RESTORE = 'SALE_RESTORE';
    public const TYPE_WASTE = 'WASTE';
    public const TYPE_MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT';

    protected $fillable = [
        'production_resource_id',
        'date',
        'type',
        'quantity',
        'balance_after',
        'reference_type',
        'reference_id',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'quantity' => 'decimal:3',
            'balance_after' => 'decimal:3',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(ProductionResource::class, 'production_resource_id');
    }
}
