<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\ProductionResource;
use App\Services\ResourceService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ResourceController extends Controller
{
    public function __construct(private readonly ResourceService $service)
    {
    }

    public function index(Request $request)
    {
        $includeArchived = $request->boolean('archived');

        $resources = $this->service->list($includeArchived)->map(fn (ProductionResource $resource) => [
            'id' => $resource->id,
            'name' => $resource->name,
            'unit' => $resource->unit,
            'warning_level' => (float) $resource->warning_level,
            'current_balance' => (float) $resource->current_balance,
            'is_active' => (bool) $resource->is_active,
            'archived_at' => $resource->archived_at?->toIso8601String(),
            'recipe_count' => (int) $resource->recipe_items_count,
            'is_low' => $resource->isLow(),
            'created_at' => $resource->created_at?->toIso8601String(),
        ])->values();

        return ApiResponse::success($resources);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'unit' => ['required', 'string', 'max:50'],
            'warning_level' => ['nullable', 'numeric', 'min:0'],
        ]);

        $resource = $this->service->create($data);

        return ApiResponse::success($resource->fresh(), 'Resource created.', 201);
    }

    public function show(int $id)
    {
        $resource = ProductionResource::query()->with('recipeItems.resource')->findOrFail($id);

        return ApiResponse::success($resource);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'unit' => ['sometimes', 'string', 'max:50'],
            'warning_level' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $resource = $this->service->update($id, $data);

        return ApiResponse::success($resource->fresh(), 'Resource updated.');
    }

    public function archive(int $id)
    {
        $this->service->archive($id);

        return ApiResponse::success(null, 'Resource archived.');
    }

    public function restore(int $id)
    {
        $this->service->restore($id);

        return ApiResponse::success(null, 'Resource restored.');
    }

    public function adjust(Request $request, int $id)
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $resource = $this->service->manualAdjust($id, (float) $data['quantity'], $data['note'] ?? null);

        return ApiResponse::success([
            'id' => $resource->id,
            'current_balance' => (float) $resource->current_balance,
        ], 'Manual adjustment recorded.');
    }

    public function units()
    {
        return ApiResponse::success([
            'Portion', 'Piece', 'Kg', 'Gram', 'Litre',
        ]);
    }
}
