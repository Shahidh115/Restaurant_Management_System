<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Models\Recipe;
use App\Models\BillItem;
use App\Repositories\RecipeRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RecipeService
{
    public function __construct(private readonly RecipeRepository $recipes)
    {
    }

    /**
     * Versioned recipe list for a menu item, newest first.
     */
    public function versionsFor(int $menuItemId): Collection
    {
        return $this->recipes->query()
            ->where('menu_item_id', $menuItemId)
            ->with('items.resource')
            ->orderByDesc('version')
            ->get();
    }

    /**
     * Create a new recipe version and make it current. Historical sales keep
     * referencing older versions via bill_items.recipe_id.
     *
     * @param array<int, array{production_resource_id: int, quantity: float}> $items
     */
    public function createVersion(int $menuItemId, array $items, ?string $name = null): Recipe
    {
        return DB::transaction(function () use ($menuItemId, $items, $name) {
            $menuItem = MenuItem::query()->findOrFail($menuItemId);

            if (empty($items)) {
                throw new \InvalidArgumentException('A recipe must contain at least one resource line.');
            }

            $nextVersion = ((int) $menuItem->recipes()->max('version')) + 1;

            $recipe = $this->recipes->create([
                'menu_item_id' => $menuItem->id,
                'version' => $nextVersion,
                'name' => $name,
                'is_current' => true,
            ]);

            foreach ($items as $line) {
                $recipe->items()->create([
                    'production_resource_id' => $line['production_resource_id'],
                    'quantity' => $line['quantity'],
                ]);
            }

            $menuItem->recipes()->where('is_current', true)->where('id', '!=', $recipe->id)->update(['is_current' => false]);

            return $this->recipes->withItems($recipe->id);
        });
    }

    /**
     * First recipe for a menu item (version 1).
     */
    public function createFirst(int $menuItemId, array $items, ?string $name = null): Recipe
    {
        return $this->createVersion($menuItemId, $items, $name);
    }

    /**
     * Edit the items of a recipe in place (only safe when it has never been used in a sale).
     */
    public function updateItems(int $recipeId, array $items): Recipe
    {
        return DB::transaction(function () use ($recipeId, $items) {
            $recipe = $this->recipes->withItems($recipeId);

            if (BillItem::query()->where('menu_item_id', $recipe->menu_item_id)->exists()) {
                throw new \InvalidArgumentException(
                    'This recipe version is referenced by historical sales and can no longer be edited. Create a new version instead.'
                );
            }

            $recipe->items()->delete();

            foreach ($items as $line) {
                $recipe->items()->create([
                    'production_resource_id' => $line['production_resource_id'],
                    'quantity' => $line['quantity'],
                ]);
            }

            return $this->recipes->withItems($recipe->id);
        });
    }

    public function activateVersion(int $recipeId): Recipe
    {
        return DB::transaction(function () use ($recipeId) {
            $recipe = $this->recipes->withItems($recipeId);
            $recipe->update(['is_current' => true, 'archived_at' => null]);

            $recipe->menuItem->recipes()
                ->where('id', '!=', $recipe->id)
                ->update(['is_current' => false]);

            return $recipe->fresh('items.resource');
        });
    }

    public function delete(int $recipeId): void
    {
        $recipe = $this->recipes->findOrFail($recipeId);

        if (BillItem::query()->where('menu_item_id', $recipe->menu_item_id)->exists()) {
            throw new \InvalidArgumentException(
                'This recipe version is referenced by historical sales and cannot be deleted.'
            );
        }

        $recipe->delete();
    }
}
