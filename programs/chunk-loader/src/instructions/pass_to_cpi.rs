use crate::{error::*, state::*};
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

// `u16` is sufficient, more than 10240 bytes cannot be passed to CPI.
pub fn pass_to_cpi_checked(ctx: Context<PassToCpi>, expected_length: u16) -> Result<()> {
    let chunk_holder = &ctx.accounts.chunk_holder;
    let len: usize = chunk_holder
        .chunks
        .iter()
        .map(|chunk| chunk.data.len())
        .sum();
    if len != expected_length as usize {
        return err!(ChunkLoaderError::DataLengthMismatch);
    }

    pass_to_cpi(ctx)
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
