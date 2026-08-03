<?php

namespace App\Repositories;

use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Model;

class MenuItemRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new MenuItem;
    }

    public function activeWithRelations()
    {
        return $this->model->newQuery()
            ->active()
            ->with(['category', 'currentRecipe.items.resource'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }
}
