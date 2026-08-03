<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use App\Models\Bill;
use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Services\ReportService;
use App\Services\ResourceService;
use App\Services\SaleService;
use App\Services\SettingsService;
use Illuminate\Http\Request;

class PosController extends Controller
{
    public function __construct(
        private readonly ResourceService $resources,
        private readonly SaleService $sales,
        private readonly SettingsService $settings,
        private readonly ReportService $reports,
    ) {
    }

    /**
     * Single lightweight payload powering the whole POS screen.
     */
    public function data()
    {
        $menuItems = MenuItem::query()
            ->active()
            ->with(['category', 'currentRecipe.items.resource'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (MenuItem $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'price' => (float) $item->price,
                'category_id' => $item->category_id,
                'category' => $item->category?->name,
                'is_favourite' => (bool) $item->is_favourite,
                'image_url' => $item->image_path ? url('storage/'.$item->image_path) : null,
                'has_recipe' => $item->currentRecipe !== null,
                'recipe_version' => $item->currentRecipe?->version,
                'max_preparable' => $this->resources->maxPreparable($item),
                'recipe' => $item->currentRecipe ? [
                    'items' => $item->currentRecipe->items->map(fn ($ri) => [
                        'resource_id' => $ri->production_resource_id,
                        'resource' => $ri->resource->name,
                        'unit' => $ri->resource->unit,
                        'quantity' => (float) $ri->quantity,
                    ]),
                ] : null,
            ]);

        $categories = \App\Models\Category::query()
            ->active()
            ->orderBy('sort_order')
            ->get(['id', 'name']);

        $resources = ProductionResource::query()
            ->active()
            ->orderBy('name')
            ->get()
            ->map(fn (ProductionResource $resource) => [
                'id' => $resource->id,
                'name' => $resource->name,
                'unit' => $resource->unit,
                'current_balance' => (float) $resource->current_balance,
                'warning_level' => (float) $resource->warning_level,
                'is_low' => $resource->isLow(),
            ]);

        return ApiResponse::success([
            'menu_items' => $menuItems,
            'categories' => $categories,
            'resources' => $resources,
            'settings' => [
                'restaurant_name' => \App\Models\Setting::get('restaurant_name', 'EL CASA'),
                'currency' => \App\Models\Setting::get('currency', '$'),
                'tax_rate' => (float) \App\Models\Setting::get('tax_rate', 0),
            ],
        ]);
    }

    /**
     * Validate a cart without persisting anything.
     */
    public function check(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $result = $this->resources->validateCart($data['items']);

        return ApiResponse::success($result, $result['ok'] ? 'Available' : 'Insufficient resources');
    }

    public function itemAvailability(int $menuItemId)
    {
        $item = MenuItem::query()->findOrFail($menuItemId);

        return ApiResponse::success([
            'menu_item_id' => $item->id,
            'max_preparable' => $this->resources->itemMaxQuantity($item->id),
        ]);
    }

    public function sale(Request $request)
    {
        $data = $this->validateSale($request);

        $bill = $this->sales->completeSale($data);

        return ApiResponse::success(
            $this->reports->billSummary($bill),
            'Sale completed.',
            201
        );
    }

    public function hold(Request $request)
    {
        $data = $this->validateSale($request);

        $bill = $this->sales->hold($data);

        return ApiResponse::success([
            'id' => $bill->id,
            'hold_code' => $bill->hold_code,
        ], 'Order held.', 201);
    }

    public function holds()
    {
        $holds = $this->sales->holds()->map(fn (Bill $bill) => $this->reports->billSummary($bill));

        return ApiResponse::success($holds);
    }

    public function getHold(string $code)
    {
        $bill = $this->sales->getHold($code);

        return ApiResponse::success($this->reports->billSummary($bill));
    }

    public function completeHold(Request $request, string $code)
    {
        $data = $this->validateSale($request);

        $bill = $this->sales->completeHold($code, $data);

        return ApiResponse::success(
            $this->reports->billSummary($bill),
            'Held order completed.',
            201
        );
    }

    public function discardHold(string $code)
    {
        $bill = $this->sales->cancelHold($code);

        return ApiResponse::success(null, 'Held order discarded.');
    }

    /**
     * Receipt payload used for printing.
     */
    public function receipt(int $billId)
    {
        $bill = Bill::query()->with('items')->findOrFail($billId);

        return ApiResponse::success([
            'bill' => $this->reports->billSummary($bill),
            'settings' => [
                'restaurant_name' => \App\Models\Setting::get('restaurant_name', 'EL CASA'),
                'address' => \App\Models\Setting::get('address', ''),
                'phone' => \App\Models\Setting::get('phone', ''),
                'receipt_header' => \App\Models\Setting::get('receipt_header', ''),
                'receipt_footer' => \App\Models\Setting::get('receipt_footer', 'Thank you!'),
                'currency' => \App\Models\Setting::get('currency', '$'),
            ],
        ]);
    }

    private function validateSale(Request $request): array
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_type' => ['nullable', 'string', 'in:cash,card,other'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return [
            'items' => $data['items'],
            'discount' => $data['discount'] ?? 0,
            'payment_type' => $data['payment_type'] ?? 'cash',
            'note' => $data['note'] ?? null,
        ];
    }
}
