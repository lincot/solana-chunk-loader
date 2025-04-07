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
        seeds = [b"CHUNK_HOLDER", &owner.key().to_bytes(), &chunk_holder_id.to_le_bytes()],
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
            8 + ChunkHolder::INIT_SPACE + chunk.self_space(),
            ChunkHolder {
                owner: owner.key(),
                chunks: vec![chunk],
            },
        )
    } else {
        let data = chunk_holder.try_borrow_data()?;
        let Some(rest_data) = data.strip_prefix(ChunkHolder::DISCRIMINATOR) else {
            return err!(ErrorCode::AccountDiscriminatorMismatch);
        };
        let space = chunk_holder.data_len() + chunk.self_space();
        let mut data = ChunkHolder::deserialize(&mut &rest_data[..])?;
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
            b"CHUNK_HOLDER",
            &owner.key().to_bytes(),
            &chunk_holder_id.to_le_bytes(),
            &[ctx.bumps.chunk_holder],
        ]],
        false,
    )?;

    Ok(())
}
