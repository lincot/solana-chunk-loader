use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseChunks<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(mut, has_one = owner, close = owner)]
    chunk_holder: Account<'info, ChunkHolder>,
}

pub fn close_chunks(_ctx: Context<CloseChunks>) -> Result<()> {
    Ok(())
}
