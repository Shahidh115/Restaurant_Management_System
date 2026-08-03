<?php

namespace App\Repositories;

use App\Models\Bill;
use Illuminate\Database\Eloquent\Model;

class BillRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new Bill;
    }

    public function withItems(int $billId): Bill
    {
        return $this->model->newQuery()->with('items')->findOrFail($billId);
    }

    public function nextInvoiceNumber(string $date): string
    {
        $prefix = (string) \App\Models\Setting::get('invoice_prefix', 'INV');

        $last = $this->model->newQuery()
            ->whereDate('bill_date', $date)
            ->orderByDesc('id')
            ->value('invoice_number');

        $sequence = 1;
        if ($last) {
            $parts = explode('-', $last);
            $sequence = (int) end($parts) + 1;
        }

        return sprintf('%s-%s-%04d', $prefix, str_replace('-', '', $date), $sequence);
    }

    public function holds()
    {
        return $this->model->newQuery()
            ->where('status', Bill::STATUS_HOLD)
            ->with('items')
            ->orderByDesc('updated_at')
            ->get();
    }
}
