using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Spear.API.Data;
using Spear.API.Models.DTOs.Auth;
using Spear.API.Services;

namespace Spear.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
[Produces("application/json")]
public class UsersController(AppDbContext db, IWalletService walletService) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserDto), 200)]
    public async Task<IActionResult> GetMe()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Balance = user.Balance
        });
    }

    [HttpGet("me/balance")]
    [ProducesResponseType(typeof(object), 200)]
    public async Task<IActionResult> GetBalance()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var balance = await walletService.GetBalanceAsync(userId);
        return Ok(new { balance });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(object), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await db.Users
            .Where(u => u.Id == id)
            .Select(u => new { u.Id, u.Username, u.CreatedAt })
            .FirstOrDefaultAsync();

        if (user is null) return NotFound();
        return Ok(user);
    }

    [HttpPut("me")]
    [ProducesResponseType(typeof(UserDto), 200)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            var taken = await db.Users.AnyAsync(u => u.Username == request.Username && u.Id != userId);
            if (taken) return Conflict(new { message = "Username already taken." });
            user.Username = request.Username;
        }

        await db.SaveChangesAsync();

        return Ok(new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Balance = user.Balance
        });
    }
}

public class UpdateProfileRequest
{
    public string? Username { get; set; }
}
