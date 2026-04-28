using Spear.API.Models.DTOs.Game;

namespace Spear.API.Services;

public interface IGameService
{
    Task<GameRoundDto?> GetCurrentRoundAsync();
    Task<GameRoundDto?> GetRoundByIdAsync(Guid roundId);
    Task<List<GameHistoryDto>> GetHistoryAsync(int count = 20);
    Task<string> GetRoundHashAsync(Guid roundId);
    Task<GameRoundDto> CreateRoundAsync();
    Task<GameRoundDto> StartRoundAsync(Guid roundId);
    Task<GameRoundDto> CrashRoundAsync(Guid roundId, decimal crashPoint);
}
