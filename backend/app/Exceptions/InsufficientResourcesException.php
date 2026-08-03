<?php

namespace App\Exceptions;

use Exception;

class InsufficientResourcesException extends Exception
{
    /**
     * @param array<int, array{resource: string, required: float, available: float, max: int}> $shortages
     */
    public function __construct(
        public readonly array $shortages,
        public readonly ?int $maxQuantity = null,
    ) {
        parent::__construct('Insufficient production resources to complete this sale.');
    }

    public function render($request): mixed
    {
        return response()->json([
            'message' => 'Insufficient production resources to complete this sale.',
            'errors' => $this->shortages,
            'max_quantity' => $this->maxQuantity,
        ], 422);
    }
}
