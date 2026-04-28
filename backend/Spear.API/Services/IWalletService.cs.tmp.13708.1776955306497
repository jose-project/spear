using Spear.API.Models.DTOs.Wallet;

namespace Spear.API.Services;

public interface IWalletService
{
    Task<TransactionDto> DepositAsync(Guid userId, DepositRequest request);
    Task<TransactionDto> WithdrawAsync(Guid userId, WithdrawRequest request);
    Task<PagedResult<TransactionDto>> GetTransactionsAsync(Guid userId, int page, int pageSize);
    Task<decimal> GetBalanceAsync(Guid userId);
}
