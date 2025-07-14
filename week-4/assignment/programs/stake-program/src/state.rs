use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakeInfo {
    pub staker: Pubkey,  // ✅ Sẽ dùng cho has_one constraint
    pub mint: Pubkey,    // ✅ Sẽ dùng cho has_one constraint
    pub stake_at: u64,
    pub is_staked: bool,
    pub amount: u64,
}
