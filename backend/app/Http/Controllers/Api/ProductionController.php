<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\ProductionResource;
use App\Services\ProductionService;
use Illuminate\Http\Request;

class ProductionController extends Controller
{
    public function __construct(private readonly ProductionService $service)
    {
    }

    public function opening(Request $request)
    {
        $date = $request->query('date') ?? today()->toDateString();

        return ApiResponse::success($this->service->openingFor($date));
    }

    public function history(Request $request)
    {
        $date = $request->query('date') ?? today()->toDateString();

        return ApiResponse::success($this->service->historyFor($date));
    }

    public function setOpening(Request $request)
    {
        $data = $request->validate([
            'production_resource_id' => ['required', 'exists:production_resources,id'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'date' => ['nullable', 'date'],
        ]);

        $resource = $this->service->setOpening(
            (int) $data['production_resource_id'],
            (float) $data['quantity'],
            $data['date'] ?? null
        );

        return ApiResponse::success([
            'id' => $resource->id,
            'current_balance' => (float) $resource->current_balance,
        ], 'Opening production set.');
    }

    public function add(Request $request)
    {
        $data = $request->validate([
            'production_resource_id' => ['required', 'exists:production_resources,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
            'date' => ['nullable', 'date'],
        ]);

        $resource = $this->service->addProduction(
            (int) $data['production_resource_id'],
            (float) $data['quantity'],
            $data['note'] ?? null,
            $data['date'] ?? null
        );

        return ApiResponse::success([
            'id' => $resource->id,
            'current_balance' => (float) $resource->current_balance,
        ], 'Production added.');
    }

    public function quickAdd(Request $request, int $resourceId)
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $resource = $this->service->addProduction(
            $resourceId,
            (float) $data['quantity'],
            'Quick add'
        );

        return ApiResponse::success([
            'id' => $resource->id,
            'current_balance' => (float) $resource->current_balance,
        ], 'Production added.');
    }

    public function resetAll(Request $request)
    {
        $date = $request->input('date') ?? today()->toDateString();
        $this->service->resetAll($date);

        return ApiResponse::success(null, 'Daily production reset to 0.');
    }
}
