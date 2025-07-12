use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::{Amm, Pool};
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

pub fn swap(
    ctx: Context<Swap>,
    swap_a: bool, // true: A -> B, false: B -> A
    input_amount: u64,
    min_output_amount: u64,
) -> Result<()> {
    let pool_a = &ctx.accounts.pool_account_a;
    let pool_b = &ctx.accounts.pool_account_b;
    let amm = &ctx.accounts.amm;
    
    // Validate inputs
    require!(input_amount > 0, AppError::DepositTooSmall);
    require!(pool_a.amount > 0 && pool_b.amount > 0, AppError::CalculationError);
    
    // Calculate output amount using constant product formula: x * y = k
    // With fee: amount_out = (y * amount_in * (10000 - fee)) / (x * 10000 + amount_in * (10000 - fee))
    let fee_basis_points = 10000u64; // 100% = 10000 basis points
    let fee_multiplier = fee_basis_points.checked_sub(amm.fee as u64).ok_or(AppError::CalculationError)?;
    
    let (input_reserve, output_reserve) = if swap_a {
        // Swap A -> B
        (pool_a.amount, pool_b.amount)
    } else {
        // Swap B -> A
        (pool_b.amount, pool_a.amount)
    };
    
    // Validate user has enough input tokens
    let user_input_balance = if swap_a {
        ctx.accounts.trader_account_a.amount
    } else {
        ctx.accounts.trader_account_b.amount
    };
    require!(user_input_balance >= input_amount, AppError::DepositTooSmall);
    
    // Calculate amount_out using: amount_out = (y * amount_in * (10000 - fee)) / (x * 10000 + amount_in * (10000 - fee))
    let input_amount_with_fee = mul_div_u64(input_amount, fee_multiplier, fee_basis_points)?;
    let numerator = (output_reserve as u128)
        .checked_mul(input_amount_with_fee as u128)
        .ok_or(AppError::CalculationError)?;
    let denominator = (input_reserve as u128)
        .checked_add(input_amount_with_fee as u128)
        .ok_or(AppError::CalculationError)?;
    
    let amount_out = numerator.checked_div(denominator).ok_or(AppError::CalculationError)? as u64;
    
    // Validate output amount
    require!(amount_out > 0, AppError::OutputTooSmall);
    require!(amount_out >= min_output_amount, AppError::OutputTooSmall);
    require!(amount_out < output_reserve, AppError::OutputTooSmall);
    
    // Verify constant product formula: (x + dx) * (y - dy) >= x * y
    let k_before = (input_reserve as u128).checked_mul(output_reserve as u128).ok_or(AppError::InvariantViolated)?;
    let k_after = (input_reserve as u128)
        .checked_add(input_amount as u128)
        .ok_or(AppError::InvariantViolated)?
        .checked_mul(
            (output_reserve as u128)
                .checked_sub(amount_out as u128)
                .ok_or(AppError::InvariantViolated)?
        )
        .ok_or(AppError::InvariantViolated)?;
    
    require!(k_after >= k_before, AppError::InvariantViolated);
    
    // Transfer input token from trader to pool
    if swap_a {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_account_a.to_account_info(),
                    to: ctx.accounts.pool_account_a.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            input_amount,
        )?;
    } else {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_account_b.to_account_info(),
                    to: ctx.accounts.pool_account_b.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            input_amount,
        )?;
    }
    
    // Transfer output token from pool to trader
    let authority_bump = ctx.bumps.pool_authority;
    let authority_seeds = &[
        &ctx.accounts.pool.amm.to_bytes(),
        &ctx.accounts.pool.mint_a.to_bytes(),
        &ctx.accounts.pool.mint_b.to_bytes(),
        b"authority".as_ref(),
        &[authority_bump],
    ];
    let signer_seeds = &[&authority_seeds[..]];
    
    if swap_a {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_account_b.to_account_info(),
                    to: ctx.accounts.trader_account_b.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;
    } else {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_account_a.to_account_info(),
                    to: ctx.accounts.trader_account_a.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;
    }
    
    let direction = if swap_a { "A -> B" } else { "B -> A" };
    msg!("Swap {}: {} input -> {} output (fee: {}%)", direction, input_amount, amount_out, amm.fee as f64 / 100.0);
    
    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        seeds = [b"amm", amm.id.as_ref()],
        bump
    )]
    pub amm: Box<Account<'info, Amm>>,

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
    pub pool: Box<Account<'info, Pool>>,

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
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_a: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_b: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = trader,
    )]
    pub trader_account_a: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = trader,
    )]
    pub trader_account_b: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub trader: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}