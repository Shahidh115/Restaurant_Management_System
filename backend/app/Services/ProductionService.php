<?php

namespace App\Services;

use App\Models\DailyProduction;
use App\Models\ProductionAdjustment;
use App\Models\ProductionResource;
use App\Models\ResourceTransaction;
use App\Repositories\ResourceRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProductionService
{
    public function __construct(private readonly ResourceRepository $resources)
    {
    }

    /**
     * Opening balances for a given date (defaults to today).
     */
    public function openingFor(?string $date = null): Collection
    {
        $date = $date ?? now()->toDateString();

        $openings = DailyProduction::query()
            ->whereDate('date', $date)
            ->get()
            ->keyBy('production_resource_id');

        return $this->resources->activeOrdered()
            ->map(function (ProductionResource $resource) use ($openings, $date) {
                return [
                    'resource_id' => $resource->id,
                    'resource' => $resource->name,
                    'unit' => $resource->unit,
                    'opening_quantity' => $openings->has($resource->id)
                        ? (float) $openings[$resource->id]->opening_quantity
                        : 0,
                    'current_balance' => (float) $resource->current_balance,
                    'date' => $date,
                ];
            });
    }

    /**
     * Set (or update) the opening production for a resource on a date.
     */
    public function setOpening(int $resourceId, float $quantity, ?string $date = null): ProductionResource
    {
        $date = $date ?? now()->toDateString();

        return DB::transaction(function () use ($resourceId, $quantity, $date) {
            /** @var ProductionResource $resource */
            $resource = $this->resources->findOrFail($resourceId);
            $resource = $resource->newQuery()->lockForUpdate()->find($resourceId);

            $dailyProduction = DailyProduction::query()
                ->whereDate('date', $date)
                ->where('production_resource_id', $resource->id)
                ->first();

            if ($dailyProduction) {
                $dailyProduction->update(['opening_quantity' => $quantity]);
            } else {
                $dailyProduction = DailyProduction::create([
                    'date' => $date,
                    'production_resource_id' => $resource->id,
                    'opening_quantity' => $quantity,
                ]);
            }

            ResourceTransaction::create([
                'production_resource_id' => $resource->id,
                'date' => $date,
                'type' => ResourceTransaction::TYPE_OPENING,
                'quantity' => $quantity,
                'balance_after' => $quantity,
                'reference_type' => 'daily_production',
                'reference_id' => $dailyProduction->id,
                'note' => "Opening production {$date}",
            ]);

            $resource->update(['current_balance' => $quantity]);

            return $resource->fresh();
        });
    }

    /**
     * Add additional production during the day.
     */
    public function addProduction(int $resourceId, float $quantity, ?string $note, ?string $date = null): ProductionResource
    {
        $date = $date ?? now()->toDateString();

        return DB::transaction(function () use ($resourceId, $quantity, $note, $date) {
            /** @var ProductionResource $resource */
            $resource = $this->resources->findOrFail($resourceId);
            $resource = $resource->newQuery()->lockForUpdate()->find($resourceId);

            $adjustment = ProductionAdjustment::create([
                'date' => $date,
                'production_resource_id' => $resource->id,
                'quantity' => $quantity,
                'note' => $note,
            ]);

            $balanceAfter = (float) $resource->current_balance + $quantity;

            ResourceTransaction::create([
                'production_resource_id' => $resource->id,
                'date' => $date,
                'type' => ResourceTransaction::TYPE_PRODUCTION,
                'quantity' => $quantity,
                'balance_after' => $balanceAfter,
                'reference_type' => 'production_adjustment',
                'reference_id' => $adjustment->id,
                'note' => $note ?? 'Additional production',
            ]);

            $resource->update(['current_balance' => $balanceAfter]);

            return $resource->fresh();
        });
    }

    /**
     * Full daily production + adjustment history for a date.
     */
    public function historyFor(?string $date = null): Collection
    {
        $date = $date ?? now()->toDateString();

        $openings = DailyProduction::query()->whereDate('date', $date)->with('resource')->get()
            ->map(fn (DailyProduction $dp) => [
                'id' => 'opening-' . $dp->id,
                'resource_id' => $dp->production_resource_id,
                'resource' => $dp->resource->name ?? 'Resource',
                'unit' => $dp->resource->unit ?? '',
                'quantity' => (float) $dp->opening_quantity,
                'type' => 'OPENING',
                'note' => "Opening production {$date}",
                'created_at' => $dp->created_at?->toIso8601String() ?? $date,
            ]);

        $adjustments = ProductionAdjustment::query()->whereDate('date', $date)->with('resource')->orderBy('id')->get()
            ->map(fn (ProductionAdjustment $pa) => [
                'id' => 'adjustment-' . $pa->id,
                'resource_id' => $pa->production_resource_id,
                'resource' => $pa->resource->name ?? 'Resource',
                'unit' => $pa->resource->unit ?? '',
                'quantity' => (float) $pa->quantity,
                'type' => 'PRODUCTION',
                'note' => $pa->note ?? 'Additional production',
                'created_at' => $pa->created_at?->toIso8601String() ?? $date,
            ]);

        return $openings->concat($adjustments)->sortByDesc('created_at')->values();
    }

    public function resetAll(?string $date = null): void
    {
        $date = $date ?? now()->toDateString();

        DB::transaction(function () use ($date) {
            $resources = $this->resources->activeOrdered();
            foreach ($resources as $resource) {
                DailyProduction::updateOrCreate(
                    ['date' => $date, 'production_resource_id' => $resource->id],
                    ['opening_quantity' => 0]
                );
                $resource->update(['current_balance' => 0]);
            }
        });
    }
}
