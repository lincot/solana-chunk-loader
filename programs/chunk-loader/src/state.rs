use anchor_lang::prelude::*;

#[account(discriminator = [1])]
#[derive(Debug, InitSpace)]
pub struct ChunkHolder {
    pub owner: Pubkey,
    #[max_len(0)]
    pub chunks: Vec<Chunk>,
}

impl ChunkHolder {
    pub fn join_chunks(&mut self) -> Vec<u8> {
        self.chunks.sort_unstable_by(|a, b| b.index.cmp(&a.index));
        let mut res = Vec::with_capacity(self.chunks.iter().map(|x| x.data.len()).sum());
        for chunk in self.chunks.iter().rev() {
            res.extend(&chunk.data);
        }
        res
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct Chunk {
    pub index: u8,
    #[max_len(0)]
    pub data: Vec<u8>,
}

impl Chunk {
    pub fn self_space(&self) -> usize {
        Self::INIT_SPACE + self.data.len()
    }
}
