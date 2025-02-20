use crate::{state::*, utils::*};
use anchor_lang::{prelude::*, Discriminator};

#[derive(Accounts)]
#[instruction(chunk_holder_id: u32)]
pub struct LoadChunk<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    /// CHECK: it's handled in the function body
    #[account(
        mut,
        seeds = [b"chunk_holder", &owner.key().to_bytes(), &chunk_holder_id.to_le_bytes()],
        bump,
    )]
    chunk_holder: AccountInfo<'info>,
    system_program: Program<'info, System>,
}

pub fn load_chunk(ctx: Context<LoadChunk>, chunk_holder_id: u32, chunk: Chunk) -> Result<()> {
    let owner = &ctx.accounts.owner;
    let chunk_holder = &ctx.accounts.chunk_holder;

    let (space, data) = if chunk_holder.data_is_empty() {
        (
            8 + ChunkHolder::space_no_chunks() + chunk.self_space(),
            ChunkHolder {
                owner: owner.key(),
                chunks: vec![chunk],
            },
        )
    } else {
        require!(
            chunk_holder.try_borrow_data()?.get(..8) == Some(&ChunkHolder::DISCRIMINATOR),
            ErrorCode::AccountDiscriminatorMismatch
        );
        let space = chunk_holder.data_len() + chunk.self_space();
        let mut data = ChunkHolder::deserialize(&mut &chunk_holder.try_borrow_data()?[8..])?;
        data.chunks.push(chunk);
        (space, data)
    };

    init_or_realloc_with_admin(
        chunk_holder,
        space,
        owner.key(),
        &data,
        owner.to_account_info(),
        &[&[
            b"chunk_holder",
            &owner.key().to_bytes(),
            &chunk_holder_id.to_le_bytes(),
            &[ctx.bumps.chunk_holder],
        ]],
        false,
    )?;

    Ok(())
}
