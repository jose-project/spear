using Microsoft.EntityFrameworkCore;
using Spear.API.Data;
using Spear.API.Models.DTOs.Bet;
using Spear.API.Models.DTOs.Wallet;
using Spear.API.Models.Entities;
using Spear.API.Models.Enums;

namespace Spear.API.Services;

public class BetService(AppDbContext db) : IBetService
{
    public async Task<BetResultDto> PlaceBetAsync(Guid userId, PlaceBetRequest request)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        var round = await db.GameRounds
            .Where(r => r.State == GameState.Waiting)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("No round is currently accepting bets.");

        if (user.Balance < request.Amount)
            throw new InvalidOperationException("Insufficient balance.");

        var existingBetsCount = await db.Bets.CountAsync(b => b.UserId == userId && b.RoundId == round.Id);
        if (existingBetsCount >= 2)
            throw new InvalidOperationException("You can only place up to 2 bets per round.");

        user.Balance -= request.Amount;

        db.Transactions.Add(new Transaction
        {
            UserId = userId,
            Type = TransactionType.BetPlaced,
            Amount = -request.Amount,
            BalanceBefore = user.Balance + request.Amount,
            BalanceAfter = user.Balance,
            Reference = round.Id.ToString()
        });

        var bet = new Bet
        {
            UserId = userId,
            RoundId = round.Id,
            Amount = request.Amount,
            AutoCashoutAt = request.AutoCashoutAt
        };

        db.Bets.Add(bet);
        await db.SaveChangesAsync();

        return MapToDto(bet, round.RoundNumber);
    }

    public async Task<BetResultDto> CashoutAsync(Guid userId, Guid betId)
    {
        var bet = await db.Bets
            .Include(b => b.Round)
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == betId && b.UserId == userId)
            ?? throw new KeyNotFoundException("Bet not found.");

        if (bet.Round.State != GameState.Running)
            throw new InvalidOperationException("Round is not running.");

        if (bet.CashedOutAt.HasValue)
            throw new InvalidOperationException("Already cashed out.");

        if (!bet.Round.StartedAt.HasValue)
            throw new InvalidOperationException("Round has not started.");

        var elapsed = (DateTime.UtcNow - bet.Round.StartedAt.Value).TotalMilliseconds;
        var multiplier = CalculateMultiplier(elapsed);

        if (multiplier >= bet.Round.CrashPoint)
            throw new InvalidOperationException("Round has already crashed.");

        bet.CashedOutAt = multiplier;
        bet.Won = true;
        bet.Profit = Math.Round(bet.Amount * multiplier - bet.Amount, 2);

        var user = bet.User;
        var balanceBefore = user.Balance;
        user.Balance += bet.Amount + bet.Profit;

        db.Transactions.Add(new Transaction
        {
            UserId = userId,
            Type = TransactionType.BetWon,
            Amount = bet.Amount + bet.Profit,
            BalanceBefore = balanceBefore,
            BalanceAfter = user.Balance,
            Reference = bet.Id.ToString()
        });

        await db.SaveChangesAsync();
        return MapToDto(bet, bet.Round.RoundNumber);
    }

    public async Task<BetResultDto?> AutoCashoutAsync(Guid betId, decimal multiplier)
    {
        var bet = await db.Bets
            .Include(b => b.Round)
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == betId && !b.CashedOutAt.HasValue);

        if (bet is null) return null;
        if (bet.Round.State != GameState.Running) return null;

        bet.CashedOutAt = multiplier;
        bet.Won = true;
        bet.Profit = Math.Round(bet.Amount * multiplier - bet.Amount, 2);

        var user = bet.User;
        var balanceBefore = user.Balance;
        user.Balance += bet.Amount + bet.Profit;

        db.Transactions.Add(new Transaction
        {
            UserId = bet.UserId,
            Type = TransactionType.BetWon,
            Amount = bet.Amount + bet.Profit,
            BalanceBefore = balanceBefore,
            BalanceAfter = user.Balance,
            Reference = bet.Id.ToString()
        });

        await db.SaveChangesAsync();
        return MapToDto(bet, bet.Round?.RoundNumber ?? 0);
    }

    public async Task<PagedResult<BetResultDto>> GetUserBetsAsync(Guid userId, int page, int pageSize)
    {
        var query = db.Bets
            .Include(b => b.Round)
            .Where(b => b.UserId == userId)
            .OrderByDescending(b => b.PlacedAt);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<BetResultDto>
        {
            Items = items.Select(b => MapToDto(b, b.Round.RoundNumber)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<List<ActiveBetDto>> GetActiveBetsAsync(Guid userId)
    {
        var round = await db.GameRounds
            .Where(r => r.State == GameState.Waiting || r.State == GameState.Running)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        if (round is null) return [];

        var bets = await db.Bets
            .Where(b => b.UserId == userId && b.RoundId == round.Id && !b.CashedOutAt.HasValue)
            .OrderBy(b => b.PlacedAt)
            .ToListAsync();

        return bets.Select(bet => new ActiveBetDto
        {
            Id = bet.Id,
            RoundId = bet.RoundId,
            Amount = bet.Amount,
            AutoCashoutAt = bet.AutoCashoutAt,
            PlacedAt = bet.PlacedAt
        }).ToList();
    }

    public async Task<List<BetResultDto>> GetRoundBetsAsync(Guid roundId)
    {
        var bets = await db.Bets
            .Include(b => b.Round)
            .Include(b => b.User)
            .Where(b => b.RoundId == roundId)
            .OrderByDescending(b => b.PlacedAt)
            .ToListAsync();

        return bets.Select(b =>
        {
            var dto = MapToDto(b, b.Round.RoundNumber);
            dto.Username = b.User?.Username;
            return dto;
        }).ToList();
    }

    public async Task<List<BetResultDto>> GetAllRecentBetsAsync(int count)
    {
        var bets = await db.Bets
            .Include(b => b.Round)
            .Include(b => b.User)
            .OrderByDescending(b => b.PlacedAt)
            .Take(count)
            .ToListAsync();

        return bets.Select(b =>
        {
            var dto = MapToDto(b, b.Round.RoundNumber);
            dto.Username = b.User?.Username;
            dto.RoundState = b.Round?.State.ToString();
            return dto;
        }).ToList();
    }

    public async Task SettleRoundBetsAsync(Guid roundId, decimal crashPoint)
    {
        var bets = await db.Bets
            .Include(b => b.User)
            .Where(b => b.RoundId == roundId && !b.CashedOutAt.HasValue)
            .ToListAsync();

        foreach (var bet in bets)
        {
            bet.Won = false;
            bet.Profit = -bet.Amount;
            bet.CashedOutAt = null;

            db.Transactions.Add(new Transaction
            {
                UserId = bet.UserId,
                Type = TransactionType.BetLost,
                Amount = 0,
                BalanceBefore = bet.User.Balance,
                BalanceAfter = bet.User.Balance,
                Reference = bet.Id.ToString()
            });
        }

        await db.SaveChangesAsync();
    }

    private static decimal CalculateMultiplier(double elapsedMs)
    {
        const double multiplierSpeed = 0.00006;
        var value = Math.Pow(Math.E, multiplierSpeed * elapsedMs);
        return Math.Round((decimal)value, 2);
    }

    private static BetResultDto MapToDto(Bet bet, long roundNumber) => new()
    {
        Id = bet.Id,
        RoundId = bet.RoundId,
        RoundNumber = roundNumber,
        Amount = bet.Amount,
        AutoCashoutAt = bet.AutoCashoutAt,
        CashedOutAt = bet.CashedOutAt,
        CrashPoint = bet.Round?.CrashPoint,
        Profit = bet.Profit,
        Won = bet.Won,
        PlacedAt = bet.PlacedAt
    };
}
