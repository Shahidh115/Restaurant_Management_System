<?php

namespace App\Repositories;

use App\Models\Recipe;
use Illuminate\Database\Eloquent\Model;

class RecipeRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new Recipe;
    }

    public function currentForMenuItem(int $menuItemId): ?Recipe
    {
        return $this->model->newQuery()
            ->where('menu_item_id', $menuItemId)
            ->where('is_current', true)
            ->whereNull('archived_at')
            ->with('items.resource')
            ->first();
    }

    public function withItems(int $recipeId): Recipe
    {
        return $this->model->newQuery()->with('items.resource')->findOrFail($recipeId);
    }
}
