namespace Spear.API.Models.Entities;

public class Bet
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid RoundId { get; set; }
    public decimal Amount { get; set; }
    public decimal? AutoCashoutAt { get; set; }
    public decimal? CashedOutAt { get; set; }
    public decimal Profit { get; set; }
    public bool Won { get; set; }
    public DateTime PlacedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public GameRound Round { get; set; } = null!;
}
