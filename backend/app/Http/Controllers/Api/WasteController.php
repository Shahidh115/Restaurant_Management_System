<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Waste;
use App\Services\WasteService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WasteController extends Controller
{
    public function __construct(private readonly WasteService $service)
    {
    }

    public function index(Request $request)
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'resource_id' => ['nullable', 'integer'],
            'type' => ['nullable', 'string'],
        ]);

        $wastes = $this->service->list($filters)->map(fn (Waste $waste) => [
            'id' => $waste->id,
            'resource_id' => $waste->production_resource_id,
            'resource' => $waste->resource->name,
            'unit' => $waste->resource->unit,
            'type' => $waste->type,
            'quantity' => (float) $waste->quantity,
            'note' => $waste->note,
            'created_at' => $waste->created_at?->toIso8601String(),
        ])->values();

        return ApiResponse::success($wastes);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'menu_item_id' => ['nullable', 'exists:menu_items,id'],
            'production_resource_id' => ['required_without:menu_item_id', 'nullable', 'exists:production_resources,id'],
            'type' => ['required', Rule::in(Waste::TYPES)],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['menu_item_id'])) {
            $wastes = $this->service->recordMenuItem($data);
            return ApiResponse::success($wastes, 'Stock deduction recorded for menu item.', 201);
        }

        $waste = $this->service->record($data);

        return ApiResponse::success($waste, 'Stock deduction recorded.', 201);
    }

    public function types()
    {
        return ApiResponse::success(Waste::TYPES);
    }
}
