<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_resources', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit')->default('Portion');
            $table->decimal('warning_level', 12, 3)->default(0);
            $table->decimal('current_balance', 12, 3)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_resources');
    }
};
