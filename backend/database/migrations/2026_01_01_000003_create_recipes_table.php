<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->constrained()->cascadeOnDelete();
            $table->integer('version')->default(1);
            $table->string('name')->nullable();
            $table->boolean('is_current')->default(false);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['menu_item_id', 'version']);
            $table->index('is_current');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipes');
    }
};
