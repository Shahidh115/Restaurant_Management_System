<?php

namespace App\Services;

use App\Models\Category;
use App\Repositories\CategoryRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class CategoryService
{
    public function __construct(private readonly CategoryRepository $categories)
    {
    }

    public function list(bool $includeArchived = false): Collection
    {
        $query = $this->categories->query();

        if (! $includeArchived) {
            $query->whereNull('archived_at');
        }

        return $query->withCount('menuItems')->orderBy('sort_order')->orderBy('name')->get();
    }

    public function create(array $data): Category
    {
        $data['slug'] = Str::slug($data['name']);

        if (Category::query()->where('slug', $data['slug'])->exists()) {
            $data['slug'] .= '-'.Str::lower(Str::random(4));
        }

        return $this->categories->create($data);
    }

    public function update(int $id, array $data): Category
    {
        $category = $this->categories->findOrFail($id);

        if (isset($data['name']) && $data['name'] !== $category->name) {
            $data['slug'] = Str::slug($data['name']);
            if (Category::query()->where('slug', $data['slug'])->where('id', '!=', $id)->exists()) {
                $data['slug'] .= '-'.Str::lower(Str::random(4));
            }
        }

        return $this->categories->update($category, $data);
    }

    public function archive(int $id): Category
    {
        $category = $this->categories->findOrFail($id);
        $category->update(['is_active' => false, 'archived_at' => now()]);

        return $category;
    }

    public function restore(int $id): Category
    {
        $category = $this->categories->findOrFail($id);
        $category->update(['is_active' => true, 'archived_at' => null]);

        return $category;
    }
}
