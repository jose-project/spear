using Spear.API.Models.Enums;

namespace Spear.API.Models.Entities;

public class GameRound
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public long RoundNumber { get; set; }
    public GameState State { get; set; } = GameState.Waiting;
    public decimal? CrashPoint { get; set; }
    public string Hash { get; set; } = string.Empty;
    public string ServerSeed { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Bet> Bets { get; set; } = [];
}
