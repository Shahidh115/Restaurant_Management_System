<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\ProductionResource;
use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_sale_with_custom_bill_date(): void
    {
        $category = Category::create(['name' => 'Main', 'slug' => 'main', 'sort_order' => 1, 'is_active' => true]);

        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Burger',
            'slug' => 'burger',
            'price' => 10.00,
            'is_active' => true,
        ]);

        $resource = ProductionResource::create([
            'name' => 'Bun',
            'unit' => 'Piece',
            'current_balance' => 50,
            'is_active' => true,
        ]);

        $recipe = Recipe::create(['menu_item_id' => $item->id, 'version' => 1, 'is_current' => true, 'is_active' => true]);
        $recipe->items()->create(['production_resource_id' => $resource->id, 'quantity' => 1]);

        $customDate = '2026-08-10';

        $response = $this->postJson('/api/v1/pos/sale', [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 2]],
            'payment_type' => 'cash',
            'bill_date' => $customDate,
        ]);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertEquals($customDate, $data['bill_date']);
        $this->assertStringContainsString('INV-20260810-0001', $data['invoice_number']);
    }
}
