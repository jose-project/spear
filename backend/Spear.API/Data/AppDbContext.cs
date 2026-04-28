using Microsoft.EntityFrameworkCore;
using Spear.API.Models.Entities;

namespace Spear.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<GameRound> GameRounds => Set<GameRound>();
    public DbSet<Bet> Bets => Set<Bet>();
    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Username).IsUnique();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Balance).HasColumnType("decimal(18,2)");
        });

        modelBuilder.Entity<GameRound>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.RoundNumber).IsUnique();
            e.Property(x => x.CrashPoint).HasColumnType("decimal(18,2)");
        });

        modelBuilder.Entity<Bet>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.AutoCashoutAt).HasColumnType("decimal(18,2)");
            e.Property(x => x.CashedOutAt).HasColumnType("decimal(18,2)");
            e.Property(x => x.Profit).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.User).WithMany(x => x.Bets).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Round).WithMany(x => x.Bets).HasForeignKey(x => x.RoundId);
        });

        modelBuilder.Entity<Transaction>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.BalanceBefore).HasColumnType("decimal(18,2)");
            e.Property(x => x.BalanceAfter).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.User).WithMany(x => x.Transactions).HasForeignKey(x => x.UserId);
        });
    }
}
