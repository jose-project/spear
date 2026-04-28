namespace Spear.API.Models.DTOs.Stats;

public class PlayerStatsDto
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public int TotalBets { get; set; }
    public int WonBets { get; set; }
    public decimal WinRate { get; set; }
    public decimal TotalWagered { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal BiggestWin { get; set; }
    public decimal BiggestMultiplier { get; set; }
}

public class LeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal TotalProfit { get; set; }
    public int TotalBets { get; set; }
}
