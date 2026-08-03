<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Services\ReportService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $service)
    {
    }

    public function dashboard()
    {
        return ApiResponse::success($this->service->dashboard());
    }

    public function summary(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->salesSummary($data['from'], $data['to']));
    }

    public function foodSales(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->foodSales($data['from'], $data['to']));
    }

    public function resourceUsage(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->resourceUsage($data['from'], $data['to']));
    }

    public function waste(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->wasteReport($data['from'], $data['to']));
    }

    public function hourly(Request $request)
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->hourlySales($data['date']));
    }

    public function trends(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return ApiResponse::success($this->service->salesTrends($data['from'], $data['to']));
    }
}
