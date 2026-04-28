using Microsoft.EntityFrameworkCore;
using Spear.API.Data;
using Spear.API.Models.DTOs.Wallet;
using Spear.API.Models.Entities;
using Spear.API.Models.Enums;

namespace Spear.API.Services;

public class WalletService(AppDbContext db) : IWalletService
{
    public async Task<TransactionDto> DepositAsync(Guid userId, DepositRequest request)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        var balanceBefore = user.Balance;
        user.Balance += request.Amount;

        var tx = new Transaction
        {
            UserId = userId,
            Type = TransactionType.Deposit,
            Amount = request.Amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = user.Balance,
            Reference = request.Method
        };

        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        return MapToDto(tx);
    }

    public async Task<TransactionDto> WithdrawAsync(Guid userId, WithdrawRequest request)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Balance < request.Amount)
            throw new InvalidOperationException("Insufficient balance.");

        var balanceBefore = user.Balance;
        user.Balance -= request.Amount;

        var tx = new Transaction
        {
            UserId = userId,
            Type = TransactionType.Withdrawal,
            Amount = -request.Amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = user.Balance,
            Reference = request.Method
        };

        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        return MapToDto(tx);
    }

    public async Task<PagedResult<TransactionDto>> GetTransactionsAsync(Guid userId, int page, int pageSize)
    {
        var query = db.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<TransactionDto>
        {
            Items = items.Select(MapToDto).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<decimal> GetBalanceAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");
        return user.Balance;
    }

    private static TransactionDto MapToDto(Transaction tx) => new()
    {
        Id = tx.Id,
        Type = tx.Type.ToString(),
        Amount = tx.Amount,
        BalanceBefore = tx.BalanceBefore,
        BalanceAfter = tx.BalanceAfter,
        Reference = tx.Reference,
        CreatedAt = tx.CreatedAt
    };
}
