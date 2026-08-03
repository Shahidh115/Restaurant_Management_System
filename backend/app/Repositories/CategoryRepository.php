<?php

namespace App\Repositories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Model;

class CategoryRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new Category;
    }

    public function activeOrdered()
    {
        return $this->model->newQuery()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }
}
