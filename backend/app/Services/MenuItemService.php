<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Repositories\MenuItemRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MenuItemService
{
    public function __construct(private readonly MenuItemRepository $menuItems)
    {
    }

    public function list(bool $includeArchived = false): Collection
    {
        $query = $this->menuItems->query()->with(['category', 'currentRecipe.items.resource']);

        if (! $includeArchived) {
            $query->whereNull('archived_at');
        }

        return $query->orderBy('sort_order')->orderBy('name')->get();
    }

    public function create(array $data): MenuItem
    {
        $data['slug'] = Str::slug($data['name']);

        if (MenuItem::query()->where('slug', $data['slug'])->exists()) {
            $data['slug'] .= '-'.Str::lower(Str::random(4));
        }

        return $this->menuItems->create($data);
    }

    public function update(int $id, array $data): MenuItem
    {
        $item = $this->menuItems->findOrFail($id);

        if (isset($data['name']) && $data['name'] !== $item->name) {
            $data['slug'] = Str::slug($data['name']);
            if (MenuItem::query()->where('slug', $data['slug'])->where('id', '!=', $id)->exists()) {
                $data['slug'] .= '-'.Str::lower(Str::random(4));
            }
        }

        return $this->menuItems->update($item, $data);
    }

    public function archive(int $id): MenuItem
    {
        $item = $this->menuItems->findOrFail($id);
        $item->update(['is_active' => false, 'archived_at' => now()]);

        return $item;
    }

    public function restore(int $id): MenuItem
    {
        $item = $this->menuItems->findOrFail($id);
        $item->update(['is_active' => true, 'archived_at' => null]);

        return $item;
    }

    public function toggleFavourite(int $id): MenuItem
    {
        $item = $this->menuItems->findOrFail($id);
        $item->update(['is_favourite' => ! $item->is_favourite]);

        return $item;
    }

    public function uploadImage(int $id, $file): MenuItem
    {
        $item = $this->menuItems->findOrFail($id);

        if ($item->image_path) {
            Storage::disk('public')->delete($item->image_path);
        }

        $path = $file->store('menu-items', 'public');
        $item->update(['image_path' => $path]);

        return $item;
    }
}
