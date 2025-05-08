/**
 * Stake creation DTO
 */
export interface CreateStakeDto {
  amount: number;
  period: number;
}

/**
 * Pagination DTO
 */
export interface PaginationDto {
  page?: number;
  limit?: number;
}
