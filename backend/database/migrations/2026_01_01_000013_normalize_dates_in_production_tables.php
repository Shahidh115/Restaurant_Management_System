<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Delete duplicate daily_production rows keeping the highest id for each date/resource pair
        DB::statement("
            DELETE FROM daily_production
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM daily_production
                GROUP BY substr(date, 1, 10), production_resource_id
            )
        ");

        // Normalize date format to YYYY-MM-DD across production tables
        DB::statement("UPDATE daily_production SET date = substr(date, 1, 10) WHERE length(date) > 10");
        DB::statement("UPDATE production_adjustments SET date = substr(date, 1, 10) WHERE length(date) > 10");
        DB::statement("UPDATE resource_transactions SET date = substr(date, 1, 10) WHERE length(date) > 10");
    }

    public function down(): void
    {
    }
};
