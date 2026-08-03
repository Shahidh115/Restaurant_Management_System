<?php

namespace App\Services;

use App\Exceptions\InsufficientResourcesException;
use App\Models\Bill;
use App\Models\BillItem;
use App\Models\MenuItem;
use App\Models\ResourceTransaction;
use App\Repositories\BillRepository;
use App\Repositories\SettingsRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaleService
{
    public function __construct(
        private readonly BillRepository $bills,
        private readonly ResourceService $resources,
        private readonly SettingsRepository $settings,
    ) {
    }

    public function list(array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = Bill::query()->with('items')->orderByDesc('id');

        if (isset($filters['date'])) {
            $query->whereDate('bill_date', $filters['date']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['from']) && isset($filters['to'])) {
            $query->whereDate('bill_date', '>=', $filters['from'])
                ->whereDate('bill_date', '<=', $filters['to']);
        }

        if (isset($filters['q'])) {
            $query->where('invoice_number', 'like', '%'.$filters['q'].'%');
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function get(int $id): Bill
    {
        return Bill::query()->with('items.menuItem')->findOrFail($id);
    }

    /**
     * Complete a sale: validate, persist, and deduct production resources.
     *
     * @throws InsufficientResourcesException
     */
    public function completeSale(array $payload): Bill
    {
        $this->resources->assertCartAvailable($payload['items']);

        return DB::transaction(function () use ($payload) {
            return $this->buildBill(
                cart: $payload['items'],
                status: Bill::STATUS_COMPLETED,
                discount: (float) ($payload['discount'] ?? 0),
                paymentType: $payload['payment_type'] ?? Bill::PAYMENT_CASH,
                customerPhone: $payload['customer_phone'] ?? null,
                note: $payload['note'] ?? null,
                date: $payload['bill_date'] ?? null,
            );
        });
    }

    public function hold(array $payload): Bill
    {
        return DB::transaction(function () use ($payload) {
            return $this->buildBill(
                cart: $payload['items'],
                status: Bill::STATUS_HOLD,
                discount: (float) ($payload['discount'] ?? 0),
                paymentType: $payload['payment_type'] ?? Bill::PAYMENT_CASH,
                customerPhone: $payload['customer_phone'] ?? null,
                note: $payload['note'] ?? null,
            );
        });
    }

    public function holds(): \Illuminate\Database\Eloquent\Collection
    {
        return $this->bills->holds();
    }

    public function getHold(string $code): Bill
    {
        return Bill::query()
            ->where('hold_code', strtoupper($code))
            ->where('status', Bill::STATUS_HOLD)
            ->with('items')
            ->firstOrFail();
    }

    /**
     * Complete a previously held order (items may have been edited).
     *
     * @throws InsufficientResourcesException
     */
    public function completeHold(string $code, array $payload): Bill
    {
        $this->resources->assertCartAvailable($payload['items']);

        return DB::transaction(function () use ($code, $payload) {
            $bill = $this->getHold($code);
            $bill->items()->delete();

            return $this->buildBill(
                cart: $payload['items'],
                status: Bill::STATUS_COMPLETED,
                discount: (float) ($payload['discount'] ?? 0),
                paymentType: $payload['payment_type'] ?? Bill::PAYMENT_CASH,
                customerPhone: $payload['customer_phone'] ?? null,
                note: $payload['note'] ?? null,
                existingBill: $bill,
            );
        });
    }

    public function cancelHold(string $code): Bill
    {
        return DB::transaction(function () use ($code) {
            $bill = $this->getHold($code);
            $bill->update([
                'status' => Bill::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'note' => ($bill->note ? $bill->note.' | ' : '').'Hold discarded',
            ]);

            return $bill;
        });
    }

    /**
     * Cancel a completed sale and restore all deducted resources.
     */
    public function cancelBill(int $id): Bill
    {
        return DB::transaction(function () use ($id) {
            $bill = $this->get($id);

            if ($bill->status !== Bill::STATUS_COMPLETED) {
                throw new \InvalidArgumentException('Only completed bills can be cancelled.');
            }

            $bill->items()->each(function (BillItem $item) use ($bill) {
                $recipe = $item->recipe;

                if (! $recipe) {
                    return;
                }

                $recipe->items->each(function ($recipeItem) use ($item, $bill) {
                    $resource = $recipeItem->resource;
                    $restoreQty = (float) $recipeItem->quantity * (float) $item->quantity;

                    $balanceAfter = (float) $resource->current_balance + $restoreQty;

                    ResourceTransaction::create([
                        'production_resource_id' => $resource->id,
                        'date' => now()->toDateString(),
                        'type' => ResourceTransaction::TYPE_SALE_RESTORE,
                        'quantity' => $restoreQty,
                        'balance_after' => $balanceAfter,
                        'reference_type' => 'bill',
                        'reference_id' => $bill->id,
                    ]);

                    $resource->increment('current_balance', $restoreQty);
                });
            });

            $bill->update([
                'status' => Bill::STATUS_CANCELLED,
                'cancelled_at' => now(),
            ]);

            return $bill->fresh('items');
        });
    }

    private function buildBill(
        array $cart,
        string $status,
        float $discount,
        string $paymentType,
        ?string $customerPhone,
        ?string $note,
        ?Bill $existingBill = null,
        ?string $date = null,
    ): Bill {
        $date = $date ?? now()->toDateString();
        $taxRate = (float) $this->settings->allAsArray()['tax_rate'] ?? 0;

        $lines = [];
        $subtotal = 0;

        foreach ($cart as $line) {
            $menuItem = MenuItem::query()->with('currentRecipe')->find($line['menu_item_id']);

            if (! $menuItem || ! $menuItem->currentRecipe) {
                throw new \InvalidArgumentException("Menu item #{$line['menu_item_id']} has no active recipe.");
            }

            $qty = (float) $line['quantity'];
            $lineTotal = round($menuItem->price * $qty, 2);
            $subtotal += $lineTotal;

            $lines[] = [
                'menu_item_id' => $menuItem->id,
                'recipe_id' => $menuItem->currentRecipe->id,
                'item_name' => $menuItem->name,
                'unit_price' => $menuItem->price,
                'quantity' => $qty,
                'line_total' => $lineTotal,
            ];
        }

        $discount = min($discount, $subtotal);
        $taxable = $subtotal - $discount;
        $taxAmount = round($taxable * ($taxRate / 100), 2);
        $total = round($taxable + $taxAmount, 2);

        $attributes = [
            'bill_date' => $date,
            'status' => $status,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'payment_type' => $paymentType,
            'customer_phone' => $customerPhone,
            'note' => $note,
            'completed_at' => $status === Bill::STATUS_COMPLETED ? now() : null,
        ];

        if ($status === Bill::STATUS_HOLD) {
            $attributes['hold_code'] = $this->uniqueHoldCode();
        }

        if ($existingBill) {
            $existingBill->fill($attributes);
            $existingBill->save();
            $bill = $existingBill;
        } else {
            $attributes['invoice_number'] = $this->bills->nextInvoiceNumber($date);
            $bill = Bill::create($attributes);
        }

        foreach ($lines as $line) {
            $bill->items()->create($line);
        }

        if ($status === Bill::STATUS_COMPLETED) {
            $this->deductResources($bill);
        }

        return $bill->fresh('items');
    }

    private function deductResources(Bill $bill): void
    {
        $date = now()->toDateString();

        $consumption = [];

        foreach ($bill->items as $item) {
            $recipe = $item->recipe;

            if (! $recipe) {
                continue;
            }

            foreach ($recipe->items as $recipeItem) {
                $resourceId = $recipeItem->production_resource_id;

                $consumption[$resourceId] ??= [
                    'resource' => $recipeItem->resource,
                    'quantity' => 0,
                ];

                $consumption[$resourceId]['quantity'] += (float) $recipeItem->quantity * (float) $item->quantity;
            }
        }

        foreach ($consumption as $resourceId => $entry) {
            $resource = $entry['resource'];
            $newBalance = max(0, (float) $resource->current_balance - $entry['quantity']);

            ResourceTransaction::create([
                'production_resource_id' => $resource->id,
                'date' => $date,
                'type' => ResourceTransaction::TYPE_SALE,
                'quantity' => -$entry['quantity'],
                'balance_after' => $newBalance,
                'reference_type' => 'bill',
                'reference_id' => $bill->id,
                'note' => 'Sale '.$bill->invoice_number,
            ]);

            $resource->update(['current_balance' => $newBalance]);
        }
    }

    private function uniqueHoldCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Bill::query()->where('hold_code', $code)->exists());

        return $code;
    }
}
