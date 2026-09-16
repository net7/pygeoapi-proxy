<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;

class TablePagination
{
    /**
     * @template T of Model
     *
     * @param  Builder<T>  $query
     * @return LengthAwarePaginator<int, T>
     */
    public static function paginate(Builder $query, int $pageSize, int $page): LengthAwarePaginator
    {
        $total = $query->toBase()->getCountForPagination();
        $lastPage = max(1, (int) ceil($total / $pageSize));

        return $query->paginate($pageSize, page: min($page, $lastPage), total: $total)
            ->withQueryString();
    }
}
