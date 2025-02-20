#![allow(unexpected_cfgs)]

use crate::{instructions::*, state::*};
use anchor_lang::prelude::*;

mod instructions;
pub mod state;
mod utils;

// DO NOT EDIT the address manually. Instead, run `./switch-env.sh`
declare_id!("ChUnQ7H46X5UeQJHVgZFBy3hGM95TwWsmvBRwQxVz3JG");

#[program]
pub mod chunk_loader {
    use super::*;

    pub fn load_chunk(ctx: Context<LoadChunk>, chunk_holder_id: u32, chunk: Chunk) -> Result<()> {
        instructions::load_chunk(ctx, chunk_holder_id, chunk)
    }

    pub fn pass_to_cpi(ctx: Context<PassToCpi>) -> Result<()> {
        instructions::pass_to_cpi(ctx)
    }

    // TODO: close_chunk_holder fallback
}
