using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Spear.API.Data;
using Spear.API.Models.DTOs.Stats;

namespace Spear.API.Controllers;

[ApiController]
[Route("api/stats")]
[Produces("application/json")]
public class StatsController(AppDbContext db) : ControllerBase
{
    [HttpGet("leaderboard")]
    [ProducesResponseType(typeof(List<LeaderboardEntryDto>), 200)]
    public async Task<IActionResult> GetLeaderboard([FromQuery] string period = "all", [FromQuery] int top = 20)
    {
        top = Math.Clamp(top, 1, 100);

        var cutoff = period switch
        {
            "daily" => DateTime.UtcNow.AddDays(-1),
            "weekly" => DateTime.UtcNow.AddDays(-7),
            _ => DateTime.MinValue
        };

        var entries = await db.Bets
            .Where(b => b.PlacedAt >= cutoff && b.CashedOutAt.HasValue)
            .GroupBy(b => new { b.UserId, b.User.Username })
            .Select(g => new LeaderboardEntryDto
            {
                UserId = g.Key.UserId,
                Username = g.Key.Username,
                TotalProfit = g.Sum(b => b.Profit),
                TotalBets = g.Count()
            })
            .OrderByDescending(e => e.TotalProfit)
            .Take(top)
            .ToListAsync();

        for (int i = 0; i < entries.Count; i++)
            entries[i].Rank = i + 1;

        return Ok(entries);
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(PlayerStatsDto), 200)]
    public async Task<IActionResult> GetMyStats()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var bets = await db.Bets
            .Where(b => b.UserId == userId && b.CashedOutAt.HasValue)
            .ToListAsync();

        var totalBets = bets.Count;
        var wonBets = bets.Count(b => b.Won);

        return Ok(new PlayerStatsDto
        {
            UserId = userId,
            Username = user.Username,
            Balance = user.Balance,
            TotalBets = totalBets,
            WonBets = wonBets,
            WinRate = totalBets > 0 ? Math.Round((decimal)wonBets / totalBets * 100, 2) : 0,
            TotalWagered = bets.Sum(b => b.Amount),
            TotalProfit = bets.Sum(b => b.Profit),
            BiggestWin = bets.Where(b => b.Won).Select(b => b.Profit).DefaultIfEmpty(0).Max(),
            BiggestMultiplier = bets.Where(b => b.Won && b.CashedOutAt.HasValue).Select(b => b.CashedOutAt!.Value).DefaultIfEmpty(0).Max()
        });
    }
}
