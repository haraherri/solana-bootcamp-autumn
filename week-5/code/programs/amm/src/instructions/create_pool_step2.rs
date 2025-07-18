use crate::state::{Amm, Pool};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

pub fn create_pool_step2(_ctx: Context<CreatePoolStep2>) -> Result<()> {
    // Pool đã được tạo ở step 1, chỉ cần verify
    Ok(())
}

#[derive(Accounts)]
pub struct CreatePoolStep2<'info> {
    #[account(
        seeds = [b"amm", amm.id.as_ref()],
        bump
    )]
    pub amm: Box<Account<'info, Amm>>,

    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref()
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: Read only authority
    #[account(
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            b"authority"
        ],
        bump,
    )]
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            amm.key().as_ref(),
            mint_a.key().as_ref(),
            mint_b.key().as_ref(),
            b"mint_liquidity"
        ],
        bump,
        mint::decimals = 6,
        mint::authority = pool_authority
    )]
    pub mint_liquidity: Box<Account<'info, Mint>>,

    pub mint_a: Box<Account<'info, Mint>>,
    pub mint_b: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_a,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_a: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_b,
        associated_token::authority = pool_authority,
    )]
    pub pool_account_b: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}