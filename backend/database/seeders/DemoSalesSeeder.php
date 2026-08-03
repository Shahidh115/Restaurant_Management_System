<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Services\ProductionService;
use App\Services\SaleService;
use Illuminate\Database\Seeder;

class DemoSalesSeeder extends Seeder
{
    public function run(): void
    {
        $production = app(ProductionService::class);
        $sales = app(SaleService::class);

        $opening = [
            'Rice Portion' => 60,
            'Dough Ball' => 180,
            'BBQ Chicken' => 25,
            'Mandi Portion' => 0,
            'Biriyani Portion' => 0,
        ];

        $days = 6;

        for ($d = $days; $d >= 0; $d--) {
            $date = today()->subDays($d)->toDateString();

            foreach ($opening as $name => $qty) {
                $resource = ProductionResource::query()->where('name', $name)->first();
                if ($resource) {
                    $production->setOpening($resource->id, $qty, $date);
                }
            }

            if ($d === 0) {
                continue;
            }

            $candidates = MenuItem::query()->with('currentRecipe')->get();
            $billCount = rand(12, 25);
            for ($b = 0; $b < $billCount; $b++) {
                $cart = [];
                $lines = rand(1, 4);
                for ($i = 0; $i < $lines; $i++) {
                    $item = $candidates->random();
                    $cart[] = [
                        'menu_item_id' => $item->id,
                        'quantity' => rand(1, 2),
                    ];
                }

                $discount = rand(0, 10) > 8 ? rand(0, 300) : 0;

                try {
                    $sales->completeSale([
                        'items' => $cart,
                        'discount' => $discount,
                        'payment_type' => collect(['cash', 'cash', 'card'])->random(),
                        'note' => null,
                        'bill_date' => $date,
                    ]);
                } catch (\Throwable $e) {
                    // Skip when resources run out during a busy day.
                    continue;
                }
            }
        }
    }
}
