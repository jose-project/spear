using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Spear.API.Models.DTOs.Wallet;
using Spear.API.Services;

namespace Spear.API.Controllers;

[ApiController]
[Route("api/wallet")]
[Authorize]
[Produces("application/json")]
public class WalletController(IWalletService walletService) : ControllerBase
{
    [HttpPost("deposit")]
    [ProducesResponseType(typeof(TransactionDto), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Deposit([FromBody] DepositRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await walletService.DepositAsync(userId, request);
        return Ok(result);
    }

    [HttpPost("withdraw")]
    [ProducesResponseType(typeof(TransactionDto), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Withdraw([FromBody] WithdrawRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await walletService.WithdrawAsync(userId, request);
        return Ok(result);
    }

    [HttpGet("transactions")]
    [ProducesResponseType(typeof(PagedResult<TransactionDto>), 200)]
    public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await walletService.GetTransactionsAsync(userId, page, pageSize);
        return Ok(result);
    }
}
