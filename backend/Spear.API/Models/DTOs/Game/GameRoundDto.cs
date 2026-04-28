using Spear.API.Models.Enums;

namespace Spear.API.Models.DTOs.Game;

public class GameRoundDto
{
    public Guid Id { get; set; }
    public long RoundNumber { get; set; }
    public string State { get; set; } = string.Empty;
    public decimal? CrashPoint { get; set; }
    public string Hash { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public double? ElapsedMs { get; set; }
    public double? RemainingWaitMs { get; set; }
}

public class GameHistoryDto
{
    public Guid Id { get; set; }
    public long RoundNumber { get; set; }
    public decimal CrashPoint { get; set; }
    public DateTime EndedAt { get; set; }
}

public class CurrentMultiplierDto
{
    public Guid RoundId { get; set; }
    public decimal Multiplier { get; set; }
    public double ElapsedMs { get; set; }
    public string State { get; set; } = string.Empty;
}
