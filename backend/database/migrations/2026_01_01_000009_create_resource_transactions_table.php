<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_resource_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('type'); // OPENING | PRODUCTION | SALE | SALE_RESTORE | WASTE | MANUAL_ADJUSTMENT
            $table->decimal('quantity', 12, 3);
            $table->decimal('balance_after', 12, 3);
            $table->string('reference_type')->nullable(); // bill | waste | production_adjustment | daily_production | manual
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['production_resource_id', 'date']);
            $table->index(['date', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_transactions');
    }
};
