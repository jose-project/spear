using Microsoft.AspNetCore.Mvc;
using Spear.API.Models.DTOs.Game;
using Spear.API.Services;

namespace Spear.API.Controllers;

[ApiController]
[Route("api/games")]
[Produces("application/json")]
public class GamesController(IGameService gameService) : ControllerBase
{
    [HttpGet("current")]
    [ProducesResponseType(typeof(GameRoundDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetCurrentRound()
    {
        var round = await gameService.GetCurrentRoundAsync();
        if (round is null) return NotFound(new { message = "No active round." });
        return Ok(round);
    }

    [HttpGet("history")]
    [ProducesResponseType(typeof(List<GameHistoryDto>), 200)]
    public async Task<IActionResult> GetHistory([FromQuery] int count = 20)
    {
        count = Math.Clamp(count, 1, 100);
        var history = await gameService.GetHistoryAsync(count);
        return Ok(history);
    }

    [HttpGet("{roundId:guid}")]
    [ProducesResponseType(typeof(GameRoundDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetRound(Guid roundId)
    {
        var round = await gameService.GetRoundByIdAsync(roundId);
        if (round is null) return NotFound();
        return Ok(round);
    }

    [HttpGet("hash/{roundId:guid}")]
    [ProducesResponseType(typeof(object), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetHash(Guid roundId)
    {
        try
        {
            var hash = await gameService.GetRoundHashAsync(roundId);
            return Ok(new { roundId, hash });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
