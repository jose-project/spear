using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Spear.API.Data;
using Spear.API.Hubs;
using Spear.API.Models.DTOs.Bet;

namespace Spear.API.Services;

public class GameLoopService(
    IServiceScopeFactory scopeFactory,
    IHubContext<GameHub> hub,
    ILogger<GameLoopService> logger) : BackgroundService
{
    private const int WaitingMs = 5000;
    private const int CrashedMs = 3000;
    private const int TickMs = 50;
    private const double MultiplierSpeed = 0.00006;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Game loop started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunRoundAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error during game round.");
                await Task.Delay(2000, stoppingToken);
            }
        }
    }

    private async Task RunRoundAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var gameService = scope.ServiceProvider.GetRequiredService<IGameService>();
        var betService = scope.ServiceProvider.GetRequiredService<IBetService>();

        var round = await gameService.CreateRoundAsync();

        await hub.Clients.All.SendAsync("RoundWaiting", new
        {
            roundId = round.Id,
            roundNumber = round.RoundNumber,
            hash = round.Hash,
            startsInMs = WaitingMs
        }, ct);

        await Task.Delay(WaitingMs, ct);

        await gameService.StartRoundAsync(round.Id);

        await hub.Clients.All.SendAsync("RoundStarted", new
        {
            roundId = round.Id,
            roundNumber = round.RoundNumber,
            startedAt = DateTime.UtcNow
        }, ct);

        var startTime = DateTime.UtcNow;
        decimal crashPoint;

        using (var innerScope = scopeFactory.CreateScope())
        {
            var db = innerScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var r = await db.GameRounds.FindAsync(round.Id);
            crashPoint = r!.CrashPoint!.Value;
        }

        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TickMs, ct);

            var elapsed = (DateTime.UtcNow - startTime).TotalMilliseconds;
            var multiplier = Math.Round((decimal)Math.Pow(Math.E, MultiplierSpeed * elapsed), 2);

            await hub.Clients.All.SendAsync("MultiplierTick", new
            {
                roundId = round.Id,
                multiplier,
                elapsedMs = elapsed
            }, ct);

            await ProcessAutoCashoutsAsync(round.Id, multiplier, scopeFactory, hub, ct);

            if (multiplier >= crashPoint)
                break;
        }

        await betService.SettleRoundBetsAsync(round.Id, crashPoint);
        await gameService.CrashRoundAsync(round.Id, crashPoint);

        await hub.Clients.All.SendAsync("RoundCrashed", new
        {
            roundId = round.Id,
            roundNumber = round.RoundNumber,
            crashPoint
        }, ct);

        logger.LogInformation("Round {Number} crashed at {CrashPoint}x", round.RoundNumber, crashPoint);

        await Task.Delay(CrashedMs, ct);
    }

    private async Task ProcessAutoCashoutsAsync(Guid roundId, decimal currentMultiplier,
        IServiceScopeFactory scopeFactory, IHubContext<GameHub> hub2, CancellationToken ct)
    {
        // Discover which bets need auto-cashout using a short-lived read scope.
        List<(Guid BetId, string Username)> targets;
        using (var readScope = scopeFactory.CreateScope())
        {
            var db = readScope.ServiceProvider.GetRequiredService<AppDbContext>();
            targets = await db.Bets
                .Include(b => b.User)
                .Where(b => b.RoundId == roundId
                    && b.AutoCashoutAt.HasValue
                    && b.AutoCashoutAt <= currentMultiplier
                    && !b.CashedOutAt.HasValue)
                .Select(b => new ValueTuple<Guid, string>(b.Id, b.User.Username))
                .ToListAsync(ct);
        }

        // Each cashout gets its own isolated scope so EF tracking never interferes.
        foreach (var (betId, username) in targets)
        {
            try
            {
                BetResultDto? result;
                using (var cashoutScope = scopeFactory.CreateScope())
                {
                    var betService = cashoutScope.ServiceProvider.GetRequiredService<IBetService>();
                    result = await betService.AutoCashoutAsync(betId, currentMultiplier);
                }

                if (result is null) continue;

                await hub2.Clients.All.SendAsync("PlayerCashedOut", new
                {
                    betId      = result.Id,
                    username,
                    amount     = result.Amount,
                    multiplier = result.CashedOutAt,
                    profit     = result.Profit
                }, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Auto-cashout failed for bet {BetId}", betId);
            }
        }
    }
}
