import { IdlTypes, Program } from "@coral-xyz/anchor";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import { ChunkLoader } from "./idl/chunk_loader";
import chunkLoaderIdl from "./idl/chunk_loader.json";
import BN from "bn.js";
import {
  cuLimitInstruction,
  InstructionWithCu,
  mockProvider,
  toTransaction,
} from "./utils";

export {
  ChunkLoader,
  chunkLoaderIdl,
  cuLimitInstruction,
  InstructionWithCu,
  toTransaction,
};

export type Chunk = IdlTypes<ChunkLoader>["chunk"];

/**
 * Maximum chunk length when sending legacy transactions.
 */
export const MAX_CHUNK_LEN = 945;
const LOAD_CHUNK_CU = 15_000;
const CLOSE_CHUNKS_CU = 10_000;
const PASS_TO_CPI_BASE_CU = 10_000;

export function getChunkLoader(
  program: Program<ChunkLoader> = new Program(
    chunkLoaderIdl as ChunkLoader,
    mockProvider,
  ),
) {
  return {
    findChunkHolder: (p: FindChunkHolderParams) => findChunkHolder(program, p),
    loadChunk: (p: LoadChunkParams) => loadChunk(program, p),
    loadByChunks: (p: LoadByChunksParams, m = MAX_CHUNK_LEN) =>
      loadByChunks(program, p, m),
    passToCpi: (p: PassToCpiParams) => passToCpi(program, p),
    closeChunks: (p: CloseChunksParams) => closeChunks(program, p),
  };
}

export type FindChunkHolderParams = {
  owner: PublicKey;
  chunkHolderId: number;
};

const findChunkHolder = (
  program: Program<ChunkLoader>,
  { owner, chunkHolderId }: FindChunkHolderParams,
) =>
  PublicKey.findProgramAddressSync([
    Buffer.from("CHUNK_HOLDER"),
    owner.toBuffer(),
    new BN(chunkHolderId).toArrayLike(Buffer, "le", 4),
  ], program.programId)[0];

export type LoadChunkParams = {
  owner: PublicKey;
  chunkHolderId: number;
  chunk: Chunk;
};

async function loadChunk(program: Program<ChunkLoader>, {
  owner,
  chunkHolderId,
  chunk,
}: LoadChunkParams): Promise<InstructionWithCu> {
  const instruction = await program.methods
    .loadChunk(chunkHolderId, chunk)
    .accounts({ owner })
    .instruction();

  return { instruction, cuLimit: LOAD_CHUNK_CU };
}

export type LoadByChunksParams = {
  owner: PublicKey;
  data: Buffer;
  chunkHolderId: number;
};

async function loadByChunks(program: Program<ChunkLoader>, {
  owner,
  data,
  chunkHolderId,
}: LoadByChunksParams, chunkLen = MAX_CHUNK_LEN): Promise<InstructionWithCu[]> {
  const instructions = [];
  for (let index = 0, offset = 0; offset < data.length; index++) {
    const slice = data.subarray(offset, offset += chunkLen);
    instructions.push(
      await loadChunk(program, {
        owner,
        chunkHolderId,
        chunk: { data: slice, index },
      }),
    );
  }
  return instructions;
}

export type PassToCpiParams = {
  owner: PublicKey;
  chunkHolderId: number;
  program: PublicKey;
  accounts: AccountMeta[];
  cpiComputeUnits: number;
};

async function passToCpi(
  program_: Program<ChunkLoader>,
  {
    owner,
    program,
    chunkHolderId,
    accounts,
    cpiComputeUnits,
  }: PassToCpiParams,
): Promise<InstructionWithCu> {
  const instruction = await program_.methods
    .passToCpi()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder(program_, { owner, chunkHolderId }),
      program,
    })
    .remainingAccounts(accounts)
    .instruction();

  return { instruction, cuLimit: PASS_TO_CPI_BASE_CU + cpiComputeUnits };
}

export type CloseChunksParams = {
  owner: PublicKey;
  chunkHolderId: number;
};

async function closeChunks(program: Program<ChunkLoader>, {
  owner,
  chunkHolderId,
}: CloseChunksParams): Promise<InstructionWithCu> {
  const instruction = await program.methods
    .closeChunks()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder(program, { owner, chunkHolderId }),
    })
    .instruction();

  return { instruction, cuLimit: CLOSE_CHUNKS_CU };
}
