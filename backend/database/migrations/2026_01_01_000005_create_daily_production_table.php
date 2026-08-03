<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_production', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->foreignId('production_resource_id')->constrained()->cascadeOnDelete();
            $table->decimal('opening_quantity', 12, 3)->default(0);
            $table->timestamps();

            $table->unique(['date', 'production_resource_id']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_production');
    }
};
