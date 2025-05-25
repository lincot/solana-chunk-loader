//! Chunk Loader error codes.

use anchor_lang::prelude::*;

/// Chunk Loader error code.
#[error_code]
pub enum ChunkLoaderError {
    #[msg("Chunk with this index has already been loaded")]
    ChunkAlreadyLoaded,
    #[msg("Sum of lengths of chunks does not match the expected length")]
    DataLengthMismatch,
}
