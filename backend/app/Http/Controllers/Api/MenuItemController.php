<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\MenuItem;
use App\Services\MenuItemService;
use App\Services\ResourceService;
use Illuminate\Http\Request;

class MenuItemController extends Controller
{
    public function __construct(
        private readonly MenuItemService $service,
        private readonly ResourceService $resources,
    ) {
    }

    public function index(Request $request)
    {
        $items = $this->service->list($request->boolean('archived'))->map(
            fn (MenuItem $item) => $this->transform($item)
        )->values();

        return ApiResponse::success($items);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'is_favourite' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = $this->service->create($data);

        return ApiResponse::success($this->transform($item), 'Menu item created.', 201);
    }

    public function show(int $id)
    {
        $item = MenuItem::query()->with(['category', 'recipes.items.resource'])->findOrFail($id);

        return ApiResponse::success([
            'id' => $item->id,
            'name' => $item->name,
            'slug' => $item->slug,
            'description' => $item->description,
            'price' => (float) $item->price,
            'category_id' => $item->category_id,
            'category' => $item->category?->name,
            'image_path' => $item->image_path,
            'is_active' => (bool) $item->is_active,
            'is_favourite' => (bool) $item->is_favourite,
            'sort_order' => $item->sort_order,
            'archived_at' => $item->archived_at?->toIso8601String(),
            'max_preparable' => $this->resources->maxPreparable($item),
            'recipes' => $item->recipes->sortByDesc('version')->values()->map(fn ($recipe) => [
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
            ]),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'category_id' => ['sometimes', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'is_favourite' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $item = $this->service->update($id, $data);

        return ApiResponse::success($this->transform($item), 'Menu item updated.');
    }

    public function uploadImage(Request $request, int $id)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:4096'],
        ]);

        $item = $this->service->uploadImage($id, $request->file('image'));

        return ApiResponse::success([
            'id' => $item->id,
            'image_path' => $item->image_path,
            'image_url' => $item->image_path ? url('storage/'.$item->image_path) : null,
        ], 'Image uploaded.');
    }

    public function archive(int $id)
    {
        $this->service->archive($id);

        return ApiResponse::success(null, 'Menu item archived.');
    }

    public function restore(int $id)
    {
        $this->service->restore($id);

        return ApiResponse::success(null, 'Menu item restored.');
    }

    public function toggleFavourite(int $id)
    {
        $item = $this->service->toggleFavourite($id);

        return ApiResponse::success([
            'id' => $item->id,
            'is_favourite' => (bool) $item->is_favourite,
        ], 'Favourite updated.');
    }

    private function transform(MenuItem $item): array
    {
        $recipe = $item->currentRecipe;

        return [
            'id' => $item->id,
            'name' => $item->name,
            'description' => $item->description,
            'price' => (float) $item->price,
            'category_id' => $item->category_id,
            'category' => $item->category?->name,
            'image_path' => $item->image_path,
            'image_url' => $item->image_path ? url('storage/'.$item->image_path) : null,
            'is_active' => (bool) $item->is_active,
            'is_favourite' => (bool) $item->is_favourite,
            'sort_order' => $item->sort_order,
            'archived_at' => $item->archived_at?->toIso8601String(),
            'has_recipe' => $recipe !== null,
            'current_recipe_id' => $recipe?->id,
            'recipe_version' => $recipe?->version,
            'recipe' => $recipe ? [
                'id' => $recipe->id,
                'version' => $recipe->version,
                'items' => $recipe->items->map(fn ($ri) => [
                    'resource_id' => $ri->production_resource_id,
                    'resource' => $ri->resource->name,
                    'unit' => $ri->resource->unit,
                    'quantity' => (float) $ri->quantity,
                ]),
            ] : null,
            'max_preparable' => $this->resources->maxPreparable($item),
        ];
    }
}
