<?php

namespace Tests\Feature;

use App\Models\ProductionResource;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_set_opening_and_reset_production_without_integrity_errors(): void
    {
        $resource = ProductionResource::create([
            'name' => 'Test Resource',
            'unit' => 'Piece',
            'current_balance' => 10,
            'is_active' => true,
        ]);

        $date = '2026-08-04';

        // 1. Set opening production
        $response = $this->postJson('/api/v1/production/opening', [
            'production_resource_id' => $resource->id,
            'quantity' => 25,
            'date' => $date,
        ]);

        $response->assertStatus(200);

        // 2. Call reset all daily production for the same date
        $resetResponse = $this->postJson('/api/v1/production/reset-all', [
            'date' => $date,
        ]);

        $resetResponse->assertStatus(200);

        // 3. Reset again to ensure idempotent behavior
        $resetAgainResponse = $this->postJson('/api/v1/production/reset-all', [
            'date' => $date,
        ]);

        $resetAgainResponse->assertStatus(200);
    }
}
