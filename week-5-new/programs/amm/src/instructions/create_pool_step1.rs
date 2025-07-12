use crate::state::{Amm, Pool};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint; // Bỏ Token vì không dùng

pub fn create_pool_step1(ctx: Context<CreatePoolStep1>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    pool.amm = ctx.accounts.amm.key();
    pool.mint_a = ctx.accounts.mint_a.key();
    pool.mint_b = ctx.accounts.mint_b.key();

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePoolStep1<'info> {
    #[account(
        seeds = [b"amm", amm.id.as_ref()],
        bump
    )]
    pub amm: Box<Account<'info, Amm>>,

    #[account(
        init,
        payer = payer,
        space = 8 + Pool::INIT_SPACE,
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref()
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    pub mint_a: Box<Account<'info, Mint>>,
    pub mint_b: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}