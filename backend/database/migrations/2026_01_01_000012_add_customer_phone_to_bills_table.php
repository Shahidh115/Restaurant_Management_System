<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            if (! Schema::hasColumn('bills', 'customer_phone')) {
                $table->string('customer_phone')->nullable()->after('payment_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            if (Schema::hasColumn('bills', 'customer_phone')) {
                $table->dropColumn('customer_phone');
            }
        });
    }
};
