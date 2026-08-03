<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Bill;
use App\Services\ReportService;
use App\Services\SaleService;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function __construct(
        private readonly SaleService $sales,
        private readonly ReportService $reports,
    ) {
    }

    public function index(Request $request)
    {
        $filters = $request->validate([
            'date' => ['nullable', 'date'],
            'status' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'q' => ['nullable', 'string', 'max:50'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $bills = $this->sales->list($filters);

        return ApiResponse::success([
            'items' => $bills->map(fn (Bill $bill) => $this->reports->billSummary($bill))->values(),
            'pagination' => [
                'current_page' => $bills->currentPage(),
                'last_page' => $bills->lastPage(),
                'per_page' => $bills->perPage(),
                'total' => $bills->total(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $bill = $this->sales->get($id);

        return ApiResponse::success($this->reports->billSummary($bill));
    }

    public function cancel(int $id)
    {
        $bill = $this->sales->cancelBill($id);

        return ApiResponse::success($this->reports->billSummary($bill), 'Bill cancelled and resources restored.');
    }
}
