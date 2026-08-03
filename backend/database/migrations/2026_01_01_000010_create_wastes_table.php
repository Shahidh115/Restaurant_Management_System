<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wastes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_resource_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // BURNT | SPOILED | STAFF_MEAL | DAMAGED | MANUAL
            $table->decimal('quantity', 12, 3);
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wastes');
    }
};
