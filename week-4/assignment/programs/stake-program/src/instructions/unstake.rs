use crate::contants::{REWARD_VAULT_SEED, STAKE_INFO_SEED};
use crate::errors::AppError;
use crate::state::StakeInfo;
use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [STAKE_INFO_SEED, staker.key().as_ref()],
        bump,
        has_one = staker,
        has_one = mint,
        close = staker, // ✅ Close account và return rent về staker
    )]
    pub stake_info: Account<'info, StakeInfo>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = stake_info,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [REWARD_VAULT_SEED, mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = reward_vault,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = staker,
    )]
    pub staker_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
    let stake_info = &ctx.accounts.stake_info;

    if !stake_info.is_staked {
        return Err(AppError::NotStaked.into());
    }

    let clock = Clock::get()?;
    let slot_passed = clock.slot - stake_info.stake_at;
    let stake_amount = stake_info.amount;

    let reward = stake_amount
        .checked_mul(slot_passed)
        .unwrap()
        .checked_div(100)
        .unwrap();
    
    msg!("stake_amount: {}, slot_passed: {}, reward: {}", stake_amount, slot_passed, reward);

    // transfer reward to staker
    let reward_vault_bump = ctx.bumps.reward_vault;
    let mint_key = ctx.accounts.mint.key();
    let reward_vault_signer_seeds: &[&[&[u8]]] = &[&[
        REWARD_VAULT_SEED, 
        mint_key.as_ref(),
        &[reward_vault_bump]
    ]];
    
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.reward_vault.to_account_info(),
                to: ctx.accounts.staker_token_account.to_account_info(),
                authority: ctx.accounts.reward_vault.to_account_info(),
            },
            reward_vault_signer_seeds,
        ),
        reward,
    )?;

    // transfer staked tokens back to staker
    let stake_info_bump = ctx.bumps.stake_info;
    let staker_key = ctx.accounts.staker.key();
    let stake_info_signer_seeds: &[&[&[u8]]] =
        &[&[STAKE_INFO_SEED, staker_key.as_ref(), &[stake_info_bump]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.staker_token_account.to_account_info(),
                authority: ctx.accounts.stake_info.to_account_info(),
            },
            stake_info_signer_seeds,
        ),
        stake_amount,
    )?;

    // ✅ KHÔNG CẦN update stake_info nữa vì account sẽ bị close
    // Account sẽ tự động close và return rent về staker nhờ close constraint

    Ok(())
}