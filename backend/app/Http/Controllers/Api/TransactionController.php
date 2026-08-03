<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\ResourceTransaction;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'type' => ['nullable', 'string'],
            'resource_id' => ['nullable', 'integer', 'exists:production_resources,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = ResourceTransaction::query()->with('resource')->orderByDesc('id');

        if (isset($filters['from'])) {
            $query->where('date', '>=', $filters['from']);
        }

        if (isset($filters['to'])) {
            $query->where('date', '<=', $filters['to']);
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['resource_id'])) {
            $query->where('production_resource_id', $filters['resource_id']);
        }

        $transactions = $query->paginate($filters['per_page'] ?? 50);

        return ApiResponse::success([
            'items' => $transactions->map(fn (ResourceTransaction $tx) => [
                'id' => $tx->id,
                'resource_id' => $tx->production_resource_id,
                'resource' => $tx->resource->name,
                'unit' => $tx->resource->unit,
                'type' => $tx->type,
                'quantity' => (float) $tx->quantity,
                'balance_after' => (float) $tx->balance_after,
                'reference_type' => $tx->reference_type,
                'reference_id' => $tx->reference_id,
                'note' => $tx->note,
                'date' => $tx->date?->toDateString(),
                'created_at' => $tx->created_at?->toIso8601String(),
            ])->values(),
            'pagination' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }
}
