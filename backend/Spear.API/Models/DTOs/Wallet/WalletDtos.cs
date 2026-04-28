using System.ComponentModel.DataAnnotations;
using Spear.API.Models.Enums;

namespace Spear.API.Models.DTOs.Wallet;

public class DepositRequest
{
    [Required, Range(1, 1000000)]
    public decimal Amount { get; set; }

    public string? Method { get; set; }
}

public class WithdrawRequest
{
    [Required, Range(1, 1000000)]
    public decimal Amount { get; set; }

    public string? Method { get; set; }
}

public class TransactionDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? Reference { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
