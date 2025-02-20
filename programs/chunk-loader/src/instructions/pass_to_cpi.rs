use crate::state::*;
use anchor_lang::{prelude::*, solana_program::instruction::Instruction};
use solana_invoke::invoke;

#[derive(Accounts)]
pub struct PassToCpi<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(mut, has_one = owner, close = owner)]
    chunk_holder: Account<'info, ChunkHolder>,
    /// CHECK: This is the program that gets invoked.
    program: AccountInfo<'info>,
}

pub fn pass_to_cpi(ctx: Context<PassToCpi>) -> Result<()> {
    let data = ctx.accounts.chunk_holder.join_chunks();
    let accounts = ctx
        .remaining_accounts
        .iter()
        .map(|x| AccountMeta {
            pubkey: x.key(),
            is_signer: x.is_signer,
            is_writable: x.is_writable,
        })
        .collect();
    let instruction = Instruction {
        program_id: ctx.accounts.program.key(),
        accounts,
        data,
    };
    invoke(&instruction, ctx.remaining_accounts)?;
    Ok(())
}
