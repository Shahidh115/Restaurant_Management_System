<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\RecipeService;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function __construct(private readonly RecipeService $service)
    {
    }

    public function versions(int $menuItemId)
    {
        $versions = $this->service->versionsFor($menuItemId)->map(fn ($recipe) => [
            'id' => $recipe->id,
            'version' => $recipe->version,
            'name' => $recipe->name,
            'is_current' => (bool) $recipe->is_current,
            'created_at' => $recipe->created_at?->toIso8601String(),
            'items' => $recipe->items->map(fn ($ri) => [
                'recipe_item_id' => $ri->id,
                'resource_id' => $ri->production_resource_id,
                'resource' => $ri->resource->name,
                'unit' => $ri->resource->unit,
                'quantity' => (float) $ri->quantity,
            ]),
        ]);

        return ApiResponse::success($versions);
    }

    public function store(Request $request, int $menuItemId)
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.production_resource_id' => ['required', 'exists:production_resources,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $recipe = $this->service->createVersion($menuItemId, $data['items'], $data['name'] ?? null);

        return ApiResponse::success($recipe->load('items.resource'), 'Recipe version created.', 201);
    }

    public function update(Request $request, int $recipeId)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.production_resource_id' => ['required', 'exists:production_resources,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $recipe = $this->service->updateItems($recipeId, $data['items']);

        return ApiResponse::success($recipe->load('items.resource'), 'Recipe updated.');
    }

    public function activate(int $recipeId)
    {
        $recipe = $this->service->activateVersion($recipeId);

        return ApiResponse::success($recipe, 'Recipe version activated.');
    }

    public function destroy(int $recipeId)
    {
        $this->service->delete($recipeId);

        return ApiResponse::success(null, 'Recipe version deleted.');
    }
}
