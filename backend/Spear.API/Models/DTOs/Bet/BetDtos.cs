using System.ComponentModel.DataAnnotations;

namespace Spear.API.Models.DTOs.Bet;

public class PlaceBetRequest
{
    [Required, Range(1, 100000)]
    public decimal Amount { get; set; }

    [Range(1.01, 1000000)]
    public decimal? AutoCashoutAt { get; set; }
}

public class BetResultDto
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public long RoundNumber { get; set; }
    public string? Username { get; set; }
    public decimal Amount { get; set; }
    public decimal? AutoCashoutAt { get; set; }
    public decimal? CashedOutAt { get; set; }
    public decimal? CrashPoint { get; set; }
    public decimal Profit { get; set; }
    public bool Won { get; set; }
    public DateTime PlacedAt { get; set; }
    public string? RoundState { get; set; }
}

public class ActiveBetDto
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public decimal Amount { get; set; }
    public decimal? AutoCashoutAt { get; set; }
    public DateTime PlacedAt { get; set; }
}
