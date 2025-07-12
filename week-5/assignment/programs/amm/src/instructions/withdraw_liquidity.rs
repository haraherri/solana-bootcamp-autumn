use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::state::Pool;
use crate::errors::AppError;

// Helper function for safe multiplication and division
fn mul_div_u64(a: u64, b: u64, c: u64) -> Result<u64> {
    if c == 0 {
        return Err(AppError::CalculationError.into());
    }
    
    // Use u128 to prevent overflow during multiplication
    let result = (a as u128)
        .checked_mul(b as u128)
        .ok_or(AppError::CalculationError)?
        .checked_div(c as u128)
        .ok_or(AppError::CalculationError)?;
    
    // Check if result fits in u64
    if result > u64::MAX as u128 {
        return Err(AppError::CalculationError.into());
    }
    
    Ok(result as u64)
}

pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, amount: u64) -> Result<()> {
    let pool_a = &ctx.accounts.pool_account_a;
    let pool_b = &ctx.accounts.pool_account_b;
    let lp_supply = ctx.accounts.mint_liquidity.supply;
    
    // Validate inputs
    require!(amount > 0, AppError::DepositTooSmall);
    require!(lp_supply > 0, AppError::CalculationError);
    require!(ctx.accounts.depositor_account_liquidity.amount >= amount, AppError::DepositTooSmall);
    
    // Calculate the amount of token A and B to withdraw
    // amount_a = pool_a * lp_amount / lp_supply
    // amount_b = pool_b * lp_amount / lp_supply
    let amount_a = mul_div_u64(pool_a.amount, amount, lp_supply)?;
    let amount_b = mul_div_u64(pool_b.amount, amount, lp_supply)?;
    
    require!(amount_a > 0, AppError::OutputTooSmall);
    require!(amount_b > 0, AppError::OutputTooSmall);
    
    // Burn LP tokens from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint_liquidity.to_account_info(),
                from: ctx.accounts.depositor_account_liquidity.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Transfer token A from pool to user
    let authority_bump = ctx.bumps.pool_authority;
    let authority_seeds = &[
        &ctx.accounts.pool.amm.to_bytes(),
        &ctx.accounts.pool.mint_a.to_bytes(),
        &ctx.accounts.pool.mint_b.to_bytes(),
        b"authority".as_ref(),
        &[authority_bump],
    ];
    let signer_seeds = &[&authority_seeds[..]];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_account_a.to_account_info(),
                to: ctx.accounts.depositor_account_a.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount_a,
    )?;
    
    // Transfer token B from pool to user
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_account_b.to_account_info(),
                to: ctx.accounts.depositor_account_b.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount_b,
    )?;

    msg!("Withdrawn {} LP tokens, received {} token A and {} token B", amount, amount_a, amount_b);
    
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(
        mut,
        seeds = [
            pool.amm.key().as_ref(),
            pool.mint_a.key().as_ref(),
            pool.mint_b.key().as_ref()
        ],
        bump,
        has_one = mint_a,
        has_one = mint_b
    )]
    pool: Box<Account<'info, Pool>>,

    /// CHECK: Read only authority
    #[account(
        seeds = [
            pool.amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            b"authority"
        ],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    pub mint_a: Box<Account<'info, Mint>>,
    pub mint_b: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            pool.amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            b"mint_liquidity"
        ],
        bump,
        mint::decimals = 6,
        mint::authority = pool_authority
    )]
    pub mint_liquidity: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pool_account_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pool_account_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = depositor,
    )]
    depositor_account_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = depositor,
    )]
    depositor_account_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_liquidity,
        associated_token::authority = depositor,
    )]
    depositor_account_liquidity: Account<'info, TokenAccount>,

    #[account(mut)]
    depositor: Signer<'info>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}