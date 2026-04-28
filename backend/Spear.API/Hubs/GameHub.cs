using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Spear.API.Services;

namespace Spear.API.Hubs;

public class GameHub(IBetService betService, ILogger<GameHub> logger) : Hub
{
    public override async Task OnConnectedAsync()
    {
        logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    [Authorize]
    public async Task Cashout(string betId)
    {
        var userId = Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = Context.User!.FindFirstValue(ClaimTypes.Name) ?? "Unknown";

        try
        {
            var result = await betService.CashoutAsync(userId, Guid.Parse(betId));
            await Clients.Caller.SendAsync("CashoutSuccess", result);
            await Clients.All.SendAsync("PlayerCashedOut", new
            {
                betId = result.Id,
                username,
                amount = result.Amount,
                multiplier = result.CashedOutAt,
                profit = result.Profit
            });
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("CashoutFailed", ex.Message);
        }
    }
}
