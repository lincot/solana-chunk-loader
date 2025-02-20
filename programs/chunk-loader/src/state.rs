use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct ChunkHolder {
    pub owner: Pubkey,
    pub chunks: Vec<Chunk>,
}

impl ChunkHolder {
    pub const fn space_no_chunks() -> usize {
        let space_owner = 32;
        let space_chunks = 4;
        space_owner + space_chunks
    }

    pub fn join_chunks(&mut self) -> Vec<u8> {
        self.chunks.sort_unstable_by(|a, b| b.index.cmp(&a.index));
        let mut res = Vec::with_capacity(self.chunks.iter().map(|x| x.data.len()).sum());
        for chunk in self.chunks.iter().rev() {
            res.extend(&chunk.data);
        }
        res
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Chunk {
    pub index: u8,
    pub data: Vec<u8>,
}

impl Chunk {
    pub fn self_space(&self) -> usize {
        let space_index = 1;
        let space_data = 4 + self.data.len();
        space_index + space_data
    }
}
