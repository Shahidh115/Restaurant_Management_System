<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $service)
    {
    }

    public function index(Request $request)
    {
        $categories = $this->service->list($request->boolean('archived'))->map(
            fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'sort_order' => $category->sort_order,
                'is_active' => (bool) $category->is_active,
                'archived_at' => $category->archived_at?->toIso8601String(),
                'menu_items_count' => (int) $category->menu_items_count,
            ]
        )->values();

        return ApiResponse::success($categories);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $category = $this->service->create($data);

        return ApiResponse::success($category->fresh(), 'Category created.', 201);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category = $this->service->update($id, $data);

        return ApiResponse::success($category->fresh(), 'Category updated.');
    }

    public function archive(int $id)
    {
        $this->service->archive($id);

        return ApiResponse::success(null, 'Category archived.');
    }

    public function restore(int $id)
    {
        $this->service->restore($id);

        return ApiResponse::success(null, 'Category restored.');
    }
}
