<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\BillItem;
use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Models\ResourceTransaction;
use App\Models\Waste;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function __construct(private readonly ResourceService $resources)
    {
    }

    public function dashboard(): array
    {
        $today = now()->toDateString();

        $summary = $this->salesSummary($today, $today);

        $topSelling = $this->topSelling($today, $today, 6);
        $hourly = $this->hourlySales($today);
        $lowResources = $this->lowResources();
        $recentBills = Bill::query()->with('items')->orderByDesc('id')->limit(8)->get();
        $productionCapacity = $this->productionCapacity();

        return [
            'date' => $today,
            'summary' => $summary,
            'top_selling' => $topSelling,
            'hourly_sales' => $hourly,
            'low_resources' => $lowResources,
            'recent_bills' => $recentBills->map(fn (Bill $bill) => $this->billSummary($bill)),
            'production_capacity' => $productionCapacity,
        ];
    }

    public function salesSummary(string $from, string $to): array
    {
        $bills = Bill::query()
            ->completed()
            ->whereDate('bill_date', '>=', $from)
            ->whereDate('bill_date', '<=', $to)
            ->get();

        $items = BillItem::query()
            ->whereHas('bill', function ($q) use ($from, $to) {
                $q->completed()
                    ->whereDate('bill_date', '>=', $from)
                    ->whereDate('bill_date', '<=', $to);
            })
            ->get();

        $revenue = $bills->sum(fn (Bill $bill) => (float) $bill->total);
        $discount = $bills->sum(fn (Bill $bill) => (float) $bill->discount);
        $itemsSold = $items->sum(fn (BillItem $item) => (float) $item->quantity);
        $count = $bills->count();
        $averageBill = $count > 0 ? $revenue / $count : 0;

        return [
            'revenue' => round($revenue, 2),
            'discount' => round($discount, 2),
            'sales_count' => $count,
            'items_sold' => $itemsSold,
            'average_bill' => round($averageBill, 2),
        ];
    }

    public function topSelling(string $from, string $to, int $limit = 10): Collection
    {
        return BillItem::query()
            ->select('menu_item_id', 'item_name')
            ->selectRaw('SUM(quantity) as quantity')
            ->selectRaw('SUM(line_total) as revenue')
            ->whereHas('bill', function ($q) use ($from, $to) {
                $q->completed()
                    ->whereDate('bill_date', '>=', $from)
                    ->whereDate('bill_date', '<=', $to);
            })
            ->groupBy('menu_item_id', 'item_name')
            ->orderByDesc('quantity')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'menu_item_id' => $row->menu_item_id,
                'name' => $row->item_name,
                'quantity' => (float) $row->quantity,
                'revenue' => round((float) $row->revenue, 2),
            ]);
    }

    public function hourlySales(string $date): array
    {
        $rows = Bill::query()
            ->completed()
            ->whereDate('bill_date', $date)
            ->get(['created_at', 'total']);

        $hours = [];
        foreach (range(0, 23) as $hour) {
            $hours[$hour] = [
                'hour' => $hour,
                'label' => sprintf('%02d:00', $hour),
                'count' => 0,
                'revenue' => 0,
            ];
        }

        foreach ($rows as $row) {
            $hour = (int) $row->created_at->format('H');
            $hours[$hour]['count']++;
            $hours[$hour]['revenue'] = round((float) $hours[$hour]['revenue'] + (float) $row->total, 2);
        }

        return array_values($hours);
    }

    public function lowResources(): Collection
    {
        return ProductionResource::query()
            ->active()
            ->get()
            ->filter(fn (ProductionResource $resource) => $resource->isLow())
            ->values()
            ->map(fn (ProductionResource $resource) => [
                'id' => $resource->id,
                'name' => $resource->name,
                'unit' => $resource->unit,
                'current_balance' => (float) $resource->current_balance,
                'warning_level' => (float) $resource->warning_level,
            ]);
    }

    public function productionCapacity(): Collection
    {
        return MenuItem::query()
            ->active()
            ->with('currentRecipe.items.resource')
            ->get()
            ->filter(fn (MenuItem $item) => $item->currentRecipe !== null)
            ->map(function (MenuItem $item) {
                $max = $this->resources->maxPreparable($item);

                $limiting = null;
                if ($max === 0) {
                    $limiting = $item->currentRecipe->items
                        ->sortBy(fn ($ri) => $ri->resource->current_balance <= 0 ? 0 : (float) $ri->resource->current_balance / (float) $ri->quantity)
                        ->first();
                }

                return [
                    'menu_item_id' => $item->id,
                    'name' => $item->name,
                    'price' => (float) $item->price,
                    'max_preparable' => $max,
                    'limiting_resource' => $limiting?->resource->name,
                ];
            })
            ->sortBy('name')
            ->values();
    }

    public function foodSales(string $from, string $to): Collection
    {
        return $this->topSelling($from, $to, 500);
    }

    public function resourceUsage(string $from, string $to): Collection
    {
        $transactions = ResourceTransaction::query()
            ->with('resource')
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->groupBy('production_resource_id');

        return ProductionResource::query()->orderBy('name')->get()->map(function (ProductionResource $resource) use ($transactions, $from, $to) {
            $rows = $transactions->get($resource->id, collect());

            $byType = $rows->groupBy('type')->map->sum(fn ($t) => (float) $t->quantity);

            $opening = $rows->where('type', ResourceTransaction::TYPE_OPENING)->sortBy('id')->first();
            $first = $rows->sortBy('id')->first();
            $last = $rows->sortBy('id')->last();

            return [
                'resource_id' => $resource->id,
                'name' => $resource->name,
                'unit' => $resource->unit,
                'opening' => round((float) ($opening?->quantity ?? ($first?->quantity ?? 0)), 3),
                'produced' => round(abs((float) ($byType[ResourceTransaction::TYPE_PRODUCTION] ?? 0)), 3),
                'sold' => round(abs((float) ($byType[ResourceTransaction::TYPE_SALE] ?? 0)), 3),
                'restored' => round((float) ($byType[ResourceTransaction::TYPE_SALE_RESTORE] ?? 0), 3),
                'wasted' => round(abs((float) ($byType[ResourceTransaction::TYPE_WASTE] ?? 0)), 3),
                'manual_adjust' => round((float) ($byType[ResourceTransaction::TYPE_MANUAL_ADJUSTMENT] ?? 0), 3),
                'closing' => round((float) ($last?->balance_after ?? 0), 3),
                'current_balance' => (float) $resource->current_balance,
            ];
        })->values();
    }

    public function wasteReport(string $from, string $to): array
    {
        $rows = Waste::query()->with('resource')->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59'])->get();

        $byType = $rows->groupBy('type')->map(fn ($group) => round((float) $group->sum(fn ($w) => $w->quantity), 3));

        $byResource = $rows->groupBy('production_resource_id')->map(function ($group) {
            $resource = $group->first()->resource;

            return [
                'resource_id' => $resource->id,
                'name' => $resource->name,
                'unit' => $resource->unit,
                'quantity' => round((float) $group->sum(fn ($w) => $w->quantity), 3),
            ];
        })->values();

        return [
            'total' => round((float) $rows->sum(fn ($w) => $w->quantity), 3),
            'by_type' => $byType,
            'by_resource' => $byResource,
            'records' => $rows->map(fn (Waste $waste) => [
                'id' => $waste->id,
                'resource' => $waste->resource->name,
                'unit' => $waste->resource->unit,
                'type' => $waste->type,
                'quantity' => (float) $waste->quantity,
                'note' => $waste->note,
                'created_at' => $waste->created_at?->toIso8601String(),
            ]),
        ];
    }

    public function salesTrends(string $from, string $to): Collection
    {
        $rows = Bill::query()
            ->completed()
            ->whereDate('bill_date', '>=', $from)
            ->whereDate('bill_date', '<=', $to)
            ->get(['bill_date', 'total']);

        $byDate = [];
        foreach ($rows as $row) {
            $day = $row->bill_date->toDateString();
            $byDate[$day] ??= ['count' => 0, 'revenue' => 0];
            $byDate[$day]['count']++;
            $byDate[$day]['revenue'] += (float) $row->total;
        }

        $series = [];
        $cursor = Carbon::parse($from);
        $end = Carbon::parse($to);

        while ($cursor->lte($end)) {
            $date = $cursor->toDateString();
            $day = $byDate[$date] ?? ['count' => 0, 'revenue' => 0];

            $series[] = [
                'date' => $date,
                'label' => $cursor->format('d M'),
                'count' => $day['count'],
                'revenue' => round($day['revenue'], 2),
            ];

            $cursor->addDay();
        }

        return collect($series);
    }

    public function billSummary(Bill $bill): array
    {
        return [
            'id' => $bill->id,
            'invoice_number' => $bill->invoice_number,
            'status' => $bill->status,
            'hold_code' => $bill->hold_code,
            'subtotal' => (float) $bill->subtotal,
            'discount' => (float) $bill->discount,
            'tax_rate' => (float) $bill->tax_rate,
            'tax_amount' => (float) $bill->tax_amount,
            'total' => (float) $bill->total,
            'payment_type' => $bill->payment_type,
            'customer_phone' => $bill->customer_phone,
            'item_count' => $bill->items->sum(fn ($item) => (float) $item->quantity),
            'created_at' => $bill->created_at?->toIso8601String(),
            'items' => $bill->items->map(fn (BillItem $item) => [
                'id' => $item->id,
                'menu_item_id' => $item->menu_item_id,
                'name' => $item->item_name,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'line_total' => (float) $item->line_total,
            ]),
        ];
    }
}
