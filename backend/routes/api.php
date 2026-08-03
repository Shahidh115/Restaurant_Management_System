<?php

use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\MenuItemController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\ProductionController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\WasteController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Dashboard & Reports
    Route::get('dashboard', [ReportController::class, 'dashboard']);
    Route::get('reports/summary', [ReportController::class, 'summary']);
    Route::get('reports/food-sales', [ReportController::class, 'foodSales']);
    Route::get('reports/resource-usage', [ReportController::class, 'resourceUsage']);
    Route::get('reports/waste', [ReportController::class, 'waste']);
    Route::get('reports/hourly', [ReportController::class, 'hourly']);
    Route::get('reports/trends', [ReportController::class, 'trends']);

    // Production resources
    Route::get('resources/units', [ResourceController::class, 'units']);
    Route::get('resources', [ResourceController::class, 'index']);
    Route::post('resources', [ResourceController::class, 'store']);
    Route::get('resources/{id}', [ResourceController::class, 'show']);
    Route::put('resources/{id}', [ResourceController::class, 'update']);
    Route::post('resources/{id}/archive', [ResourceController::class, 'archive']);
    Route::post('resources/{id}/restore', [ResourceController::class, 'restore']);
    Route::post('resources/{id}/adjust', [ResourceController::class, 'adjust']);

    // Daily production
    Route::get('production/opening', [ProductionController::class, 'opening']);
    Route::get('production/history', [ProductionController::class, 'history']);
    Route::post('production/opening', [ProductionController::class, 'setOpening']);
    Route::post('production/add', [ProductionController::class, 'add']);
    Route::post('production/resources/{resourceId}/quick-add', [ProductionController::class, 'quickAdd']);

    // Categories
    Route::get('categories', [CategoryController::class, 'index']);
    Route::post('categories', [CategoryController::class, 'store']);
    Route::put('categories/{id}', [CategoryController::class, 'update']);
    Route::post('categories/{id}/archive', [CategoryController::class, 'archive']);
    Route::post('categories/{id}/restore', [CategoryController::class, 'restore']);

    // Menu items
    Route::get('menu-items', [MenuItemController::class, 'index']);
    Route::post('menu-items', [MenuItemController::class, 'store']);
    Route::get('menu-items/{id}', [MenuItemController::class, 'show']);
    Route::put('menu-items/{id}', [MenuItemController::class, 'update']);
    Route::post('menu-items/{id}/image', [MenuItemController::class, 'uploadImage']);
    Route::post('menu-items/{id}/archive', [MenuItemController::class, 'archive']);
    Route::post('menu-items/{id}/restore', [MenuItemController::class, 'restore']);
    Route::post('menu-items/{id}/favourite', [MenuItemController::class, 'toggleFavourite']);

    // Recipes
    Route::get('menu-items/{menuItemId}/recipes', [RecipeController::class, 'versions']);
    Route::post('menu-items/{menuItemId}/recipes', [RecipeController::class, 'store']);
    Route::put('recipes/{recipeId}', [RecipeController::class, 'update']);
    Route::post('recipes/{recipeId}/activate', [RecipeController::class, 'activate']);
    Route::delete('recipes/{recipeId}', [RecipeController::class, 'destroy']);

    // POS
    Route::get('pos/data', [PosController::class, 'data']);
    Route::post('pos/check', [PosController::class, 'check']);
    Route::get('pos/items/{menuItemId}/availability', [PosController::class, 'itemAvailability']);
    Route::post('pos/sale', [PosController::class, 'sale']);
    Route::post('pos/hold', [PosController::class, 'hold']);
    Route::get('pos/holds', [PosController::class, 'holds']);
    Route::get('pos/holds/{code}', [PosController::class, 'getHold']);
    Route::post('pos/holds/{code}/complete', [PosController::class, 'completeHold']);
    Route::delete('pos/holds/{code}', [PosController::class, 'discardHold']);
    Route::get('pos/receipt/{billId}', [PosController::class, 'receipt']);

    // Sales
    Route::get('bills', [BillController::class, 'index']);
    Route::get('bills/{id}', [BillController::class, 'show']);
    Route::post('bills/{id}/cancel', [BillController::class, 'cancel']);

    // Resource transactions
    Route::get('transactions', [TransactionController::class, 'index']);

    // Waste
    Route::get('wastes/types', [WasteController::class, 'types']);
    Route::get('wastes', [WasteController::class, 'index']);
    Route::post('wastes', [WasteController::class, 'store']);

    // Settings
    Route::get('settings', [SettingsController::class, 'index']);
    Route::put('settings', [SettingsController::class, 'update']);
    Route::post('settings/logo', [SettingsController::class, 'uploadLogo']);
});
