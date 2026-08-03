<?php

namespace App\Repositories;

use App\Models\ProductionResource;
use Illuminate\Database\Eloquent\Model;

class ResourceRepository extends BaseRepository
{
    protected function makeModel(): Model
    {
        return new ProductionResource;
    }

    public function activeOrdered()
    {
        return $this->model->newQuery()
            ->active()
            ->orderBy('name')
            ->get();
    }

    public function lowOnStock()
    {
        return $this->model->newQuery()
            ->active()
            ->get()
            ->filter(fn (ProductionResource $resource) => $resource->isLow());
    }
}
