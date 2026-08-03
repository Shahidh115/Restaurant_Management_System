<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Models\ResourceTransaction;
use App\Models\Waste;
use App\Repositories\ResourceRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class WasteService
{
    public function __construct(private readonly ResourceRepository $resources)
    {
    }

    public function list(array $filters = []): Collection
    {
        $query = Waste::query()->with('resource')->orderByDesc('id');

        if (isset($filters['from']) && isset($filters['to'])) {
            $query->whereBetween('created_at', [$filters['from'].' 00:00:00', $filters['to'].' 23:59:59']);
        }

        if (isset($filters['resource_id'])) {
            $query->where('production_resource_id', $filters['resource_id']);
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        return $query->get();
    }

    /**
     * Record waste and deduct the resource.
     */
    public function record(array $payload): Waste
    {
        return DB::transaction(function () use ($payload) {
            $resource = $this->resources->findOrFail($payload['production_resource_id']);
            $resource = $resource->newQuery()->lockForUpdate()->find($resource->id);

            $quantity = (float) $payload['quantity'];

            if ($quantity <= 0) {
                throw new \InvalidArgumentException('Quantity must be greater than zero.');
            }

            if ($quantity > (float) $resource->current_balance) {
                throw new \InvalidArgumentException(
                    "Only {$resource->current_balance} {$resource->unit} of {$resource->name} is available."
                );
            }

            $waste = Waste::create([
                'production_resource_id' => $resource->id,
                'type' => $payload['type'],
                'quantity' => $quantity,
                'note' => $payload['note'] ?? null,
            ]);

            $balanceAfter = (float) $resource->current_balance - $quantity;

            ResourceTransaction::create([
                'production_resource_id' => $resource->id,
                'date' => now()->toDateString(),
                'type' => ResourceTransaction::TYPE_WASTE,
                'quantity' => -$quantity,
                'balance_after' => $balanceAfter,
                'reference_type' => 'waste',
                'reference_id' => $waste->id,
                'note' => $waste->type.' waste',
            ]);

            $resource->update(['current_balance' => $balanceAfter]);

            return $waste->fresh('resource');
        });
    }

    /**
     * Record stock deduction by Menu Item (deducting all consumed recipe resources).
     */
    public function recordMenuItem(array $payload): Collection
    {
        return DB::transaction(function () use ($payload) {
            /** @var MenuItem $menuItem */
            $menuItem = MenuItem::query()->with('currentRecipe.items.resource')->findOrFail($payload['menu_item_id']);
            $recipe = $menuItem->currentRecipe;

            if (! $recipe || $recipe->items->isEmpty()) {
                throw new \InvalidArgumentException("Menu item '{$menuItem->name}' has no active recipe configured.");
            }

            $itemQty = (float) $payload['quantity'];
            if ($itemQty <= 0) {
                throw new \InvalidArgumentException('Quantity must be greater than zero.');
            }

            $noteText = "{$itemQty}x {$menuItem->name}" . (! empty($payload['note']) ? " ({$payload['note']})" : '');
            $wastes = collect();

            foreach ($recipe->items as $recipeItem) {
                /** @var ProductionResource $resource */
                $resource = $recipeItem->resource;
                if (! $resource) {
                    continue;
                }
                $resource = $resource->newQuery()->lockForUpdate()->find($resource->id);

                $neededQty = (float) $recipeItem->quantity * $itemQty;

                if ($neededQty > (float) $resource->current_balance) {
                    throw new \InvalidArgumentException(
                        "Insufficient stock for {$resource->name}. Needed: {$neededQty} {$resource->unit}, Available: {$resource->current_balance} {$resource->unit}."
                    );
                }

                $waste = Waste::create([
                    'production_resource_id' => $resource->id,
                    'type' => $payload['type'],
                    'quantity' => $neededQty,
                    'note' => $noteText,
                ]);

                $balanceAfter = (float) $resource->current_balance - $neededQty;

                ResourceTransaction::create([
                    'production_resource_id' => $resource->id,
                    'date' => now()->toDateString(),
                    'type' => ResourceTransaction::TYPE_WASTE,
                    'quantity' => -$neededQty,
                    'balance_after' => $balanceAfter,
                    'reference_type' => 'waste',
                    'reference_id' => $waste->id,
                    'note' => $payload['type'] . ' - ' . $noteText,
                ]);

                $resource->update(['current_balance' => $balanceAfter]);
                $wastes->push($waste->fresh('resource'));
            }

            return $wastes;
        });
    }
}
