<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductionResource extends Model
{
    protected $fillable = [
        'name',
        'unit',
        'warning_level',
        'current_balance',
        'is_active',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'warning_level' => 'decimal:3',
            'current_balance' => 'decimal:3',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function recipeItems(): HasMany
    {
        return $this->hasMany(RecipeItem::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(ResourceTransaction::class);
    }

    public function wastes(): HasMany
    {
        return $this->hasMany(Waste::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->whereNull('archived_at');
    }

    public function isLow(): bool
    {
        return (float) $this->current_balance <= (float) $this->warning_level;
    }
}
