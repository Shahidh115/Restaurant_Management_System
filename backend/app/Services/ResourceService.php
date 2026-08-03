<?php

namespace App\Services;

use App\Exceptions\InsufficientResourcesException;
use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Models\ResourceTransaction;
use App\Repositories\ResourceRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ResourceService
{
    public function __construct(
        private readonly ResourceRepository $resources,
    ) {
    }

    public function list(bool $includeArchived = false): Collection
    {
        $query = $this->resources->query();

        if (! $includeArchived) {
            $query->whereNull('archived_at');
        }

        return $query
            ->withCount('recipeItems')
            ->orderBy('name')
            ->get();
    }

    public function create(array $data): ProductionResource
    {
        return $this->resources->create([
            'name' => $data['name'],
            'unit' => $data['unit'] ?? 'Portion',
            'warning_level' => $data['warning_level'] ?? 0,
            'current_balance' => 0,
        ]);
    }

    public function update(int $id, array $data): ProductionResource
    {
        $resource = $this->resources->findOrFail($id);

        return $this->resources->update($resource, $data);
    }

    public function archive(int $id): ProductionResource
    {
        $resource = $this->resources->findOrFail($id);
        $resource->update(['is_active' => false, 'archived_at' => now()]);

        return $resource;
    }

    public function restore(int $id): ProductionResource
    {
        $resource = $this->resources->findOrFail($id);
        $resource->update(['is_active' => true, 'archived_at' => null]);

        return $resource;
    }

    public function manualAdjust(int $id, float $quantity, ?string $note): ProductionResource
    {
        return DB::transaction(function () use ($id, $quantity, $note) {
            /** @var ProductionResource $resource */
            $resource = $this->resources->findOrFail($id);
            $resource = $resource->newQuery()->lockForUpdate()->find($id);

            $balanceAfter = max(0, (float) $resource->current_balance + $quantity);

            ResourceTransaction::create([
                'production_resource_id' => $resource->id,
                'date' => now()->toDateString(),
                'type' => ResourceTransaction::TYPE_MANUAL_ADJUSTMENT,
                'quantity' => $quantity,
                'balance_after' => $balanceAfter,
                'reference_type' => 'manual',
                'note' => $note,
            ]);

            $resource->update(['current_balance' => $balanceAfter]);

            return $resource->fresh();
        });
    }

    /**
     * Validate that every menu item in the cart can be fulfilled with current balances.
     * Throws when the cart exceeds availability for any required resource.
     *
     * @param array<int, array{menu_item_id: int, quantity: float}> $cart
     */
    public function assertCartAvailable(array $cart): void
    {        $shortages = $this->cartShortages($cart);

        if (empty($shortages)) {
            return;
        }

        $offendingLine = $shortages[0]['line'];
        $maxQuantity = $this->itemMaxQuantity(
            (int) $offendingLine['menu_item_id'],
            $this->cartWithoutLine($cart, $offendingLine['menu_item_id'], $offendingLine['quantity'])
        );

        throw new InsufficientResourcesException($shortages, max(0, $maxQuantity));
    }

    /**
     * Validate a cart and return a detailed availability summary.
     *
     * @param array<int, array{menu_item_id: int, quantity: float}> $cart
     * @return array<string, mixed>
     */
    public function validateCart(array $cart): array
    {
        $requirements = $this->cartRequirements($cart);

        $shortages = [];
        $maxByResource = [];

        foreach ($requirements as $resourceId => $item) {
            if ($item['required'] > $item['available']) {
                $shortages[] = [
                    'resource_id' => $resourceId,
                    'resource' => $item['resource'],
                    'unit' => $item['unit'],
                    'required' => $item['required'],
                    'available' => $item['available'],
                ];
            }

            $maxByResource[$resourceId] = [
                'resource' => $item['resource'],
                'unit' => $item['unit'],
                'available' => $item['available'],
            ];
        }

        return [
            'ok' => empty($shortages),
            'shortages' => $shortages,
            'max_by_resource' => $maxByResource,
            'requirements' => $requirements,
        ];
    }

    /**
     * Aggregated resource requirements of a cart keyed by resource id.
     *
     * @return array<int, array{resource_id: int, resource: string, unit: string, available: float, required: float, line: array|null}>
     */
    public function cartRequirements(array $cart): array
    {
        $requirements = [];

        foreach ($cart as $line) {
            $menuItem = MenuItem::query()
                ->with('currentRecipe.items.resource')
                ->find($line['menu_item_id']);

            if (! $menuItem || ! $menuItem->currentRecipe) {
                continue;
            }

            $qty = (float) $line['quantity'];

            foreach ($menuItem->currentRecipe->items as $recipeItem) {
                $resourceId = $recipeItem->production_resource_id;

                $requirements[$resourceId] ??= [
                    'resource_id' => $resourceId,
                    'resource' => $recipeItem->resource->name,
                    'unit' => $recipeItem->resource->unit,
                    'available' => (float) $recipeItem->resource->current_balance,
                    'required' => 0,
                    'line' => null,
                ];

                $requirements[$resourceId]['required'] += (float) $recipeItem->quantity * $qty;
                $requirements[$resourceId]['line'] = $line;
            }
        }

        return $requirements;
    }

    /**
     * @return array<int, array{resource_id: int, resource: string, unit: string, required: float, available: float, line: array}>
     */
    public function cartShortages(array $cart): array
    {
        $shortages = [];

        foreach ($this->cartRequirements($cart) as $item) {
            if ($item['required'] > $item['available']) {
                $shortages[] = [
                    'resource_id' => $item['resource_id'],
                    'resource' => $item['resource'],
                    'unit' => $item['unit'],
                    'required' => $item['required'],
                    'available' => $item['available'],
                    'line' => $item['line'],
                ];
            }
        }

        return $shortages;
    }

    /**
     * Maximum quantity of a single menu item that can currently be produced.
     */
    public function maxPreparable(MenuItem $menuItem): int
    {
        return $this->itemMaxQuantity($menuItem->id);
    }

    /**
     * Maximum quantity of a single menu item that can be produced given the
     * current balances after removing the supplied cart lines.
     */
    public function itemMaxQuantity(int $menuItemId, array $otherCartLines = []): int
    {
        $menuItem = MenuItem::query()->with('currentRecipe.items.resource')->find($menuItemId);

        if (! $menuItem || ! $menuItem->currentRecipe || $menuItem->currentRecipe->items->isEmpty()) {
            return 0;
        }

        $consumed = [];
        foreach ($otherCartLines as $line) {
            $item = MenuItem::query()->with('currentRecipe.items.resource')->find($line['menu_item_id']);
            if (! $item || ! $item->currentRecipe) {
                continue;
            }
            foreach ($item->currentRecipe->items as $ri) {
                $consumed[$ri->production_resource_id] = ($consumed[$ri->production_resource_id] ?? 0) + (float) $ri->quantity * (float) $line['quantity'];
            }
        }

        $max = PHP_INT_MAX;

        foreach ($menuItem->currentRecipe->items as $item) {
            $perDish = (float) $item->quantity;
            if ($perDish <= 0) {
                continue;
            }
            $remaining = (float) $item->resource->current_balance - ($consumed[$item->production_resource_id] ?? 0);
            $max = min($max, (int) floor($remaining / $perDish));
        }

        return $max === PHP_INT_MAX ? 0 : max(0, $max);
    }

    private function cartWithoutLine(array $cart, int $menuItemId, float $quantity): array
    {
        return array_values(array_filter(
            $cart,
            fn (array $line) => ! ((int) $line['menu_item_id'] === $menuItemId && (float) $line['quantity'] === $quantity)
        ));
    }
}
