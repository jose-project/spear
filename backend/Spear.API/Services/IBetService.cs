using Spear.API.Models.DTOs.Bet;
using Spear.API.Models.DTOs.Wallet;

namespace Spear.API.Services;

public interface IBetService
{
    Task<BetResultDto> PlaceBetAsync(Guid userId, PlaceBetRequest request);
    Task<BetResultDto> CashoutAsync(Guid userId, Guid betId);
    Task<BetResultDto?> AutoCashoutAsync(Guid betId, decimal multiplier);
    Task<PagedResult<BetResultDto>> GetUserBetsAsync(Guid userId, int page, int pageSize);
    Task<List<ActiveBetDto>> GetActiveBetsAsync(Guid userId);
    Task<List<BetResultDto>> GetRoundBetsAsync(Guid roundId);
    Task<List<BetResultDto>> GetAllRecentBetsAsync(int count);
    Task SettleRoundBetsAsync(Guid roundId, decimal crashPoint);
}
