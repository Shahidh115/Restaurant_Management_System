<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Models\Recipe;
use App\Models\Setting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class BaseDataSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'restaurant_name' => 'EL CASA',
            'logo_path' => null,
            'address' => '123 Main Street, Colombo',
            'phone' => '+94 11 234 5678',
            'receipt_header' => 'Welcome to EL CASA',
            'receipt_footer' => 'Thank you! Please come again.',
            'currency' => 'Rs.',
            'tax_rate' => '0',
            'printer_config' => null,
            'invoice_prefix' => 'INV',
        ];

        foreach ($settings as $key => $value) {
            Setting::set($key, $value);
        }

        $resourceNames = [
            'Rice Portion' => 'Portion',
            'Dough Ball' => 'Piece',
            'BBQ Chicken' => 'Piece',
            'Mandi Portion' => 'Portion',
            'Biriyani Portion' => 'Portion',
        ];

        $resources = [];
        foreach ($resourceNames as $name => $unit) {
            $resources[$name] = ProductionResource::create([
                'name' => $name,
                'unit' => $unit,
                'warning_level' => $name === 'BBQ Chicken' ? 5 : 10,
                'current_balance' => 0,
            ]);
        }

        $categories = [];
        foreach (['Rice', 'Kottu', 'Parata', 'BBQ', 'Shawarma', 'Drinks', 'Desserts'] as $sort => $name) {
            $categories[$name] = Category::create([
                'name' => $name,
                'slug' => Str::slug($name),
                'sort_order' => $sort,
            ]);
        }

        $menu = [
            'Chicken Fried Rice' => ['category' => 'Rice', 'price' => 950, 'recipe' => ['Rice Portion' => 1]],
            'Mixed Fried Rice' => ['category' => 'Rice', 'price' => 1100, 'recipe' => ['Rice Portion' => 1]],
            'Nasi Goreng' => ['category' => 'Rice', 'price' => 1050, 'recipe' => ['Rice Portion' => 1]],
            'Parata' => ['category' => 'Parata', 'price' => 120, 'recipe' => ['Dough Ball' => 1]],
            'Egg Roti' => ['category' => 'Parata', 'price' => 180, 'recipe' => ['Dough Ball' => 1]],
            'Chicken Kottu' => ['category' => 'Kottu', 'price' => 1300, 'recipe' => ['Dough Ball' => 2]],
            'Shawarma' => ['category' => 'Shawarma', 'price' => 650, 'recipe' => ['Dough Ball' => 1]],
            'BBQ Package' => ['category' => 'BBQ', 'price' => 4500, 'recipe' => ['BBQ Chicken' => 1, 'Dough Ball' => 4]],
        ];

        foreach ($menu as $name => $spec) {
            $item = MenuItem::create([
                'category_id' => $categories[$spec['category']]->id,
                'name' => $name,
                'slug' => Str::slug($name),
                'price' => $spec['price'],
            ]);

            $recipe = Recipe::create([
                'menu_item_id' => $item->id,
                'version' => 1,
                'is_current' => true,
            ]);

            foreach ($spec['recipe'] as $resourceName => $quantity) {
                $recipe->items()->create([
                    'production_resource_id' => $resources[$resourceName]->id,
                    'quantity' => $quantity,
                ]);
            }
        }
    }
}
