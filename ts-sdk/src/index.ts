import { IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Commitment,
  Connection,
  GetAccountInfoConfig,
  PublicKey,
} from "@solana/web3.js";
import { ChunkLoader } from "./idl/chunk_loader";
import chunkLoaderIdl from "./idl/chunk_loader.json";
import BN from "bn.js";
import {
  cuLimitInstruction,
  fetchAccount,
  InstructionWithCu,
  mockProvider,
  toTransaction,
} from "./utils";

export { cuLimitInstruction, InstructionWithCu, toTransaction };

export type ChunkHolder = IdlTypes<ChunkLoader>["chunkHolder"];
export type Chunk = IdlTypes<ChunkLoader>["chunk"];

/**
 * Maximum chunk length when sending versioned transactions.
 */
export const MAX_CHUNK_LEN = 943;
const LOAD_CHUNK_CU = 15_000;
const CLOSE_CHUNKS_CU = 10_000;
const PASS_TO_CPI_BASE_CU = 10_000;

const CHUNK_LOADER_PROGRAM = new Program(chunkLoaderIdl, mockProvider);
export const PROGRAM_ID = CHUNK_LOADER_PROGRAM.programId;

export type FindChunkHolderParams = {
  owner: PublicKey;
  chunkHolderId: number;
};

export const findChunkHolder = (
  { owner, chunkHolderId }: FindChunkHolderParams,
) =>
  PublicKey.findProgramAddressSync([
    Buffer.from("CHUNK_HOLDER"),
    owner.toBuffer(),
    new BN(chunkHolderId).toArrayLike(Buffer, "le", 4),
  ], CHUNK_LOADER_PROGRAM.programId)[0];

export type LoadChunkParams = {
  owner: PublicKey;
  chunkHolderId: number;
  chunk: Chunk;
};

async function loadChunk({
  owner,
  chunkHolderId,
  chunk,
}: LoadChunkParams): Promise<InstructionWithCu> {
  const instruction = await CHUNK_LOADER_PROGRAM.methods
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

export async function loadByChunks({
  owner,
  data,
  chunkHolderId,
}: LoadByChunksParams, chunkLen = MAX_CHUNK_LEN): Promise<InstructionWithCu[]> {
  const ixs = [];
  for (let index = 0, offset = 0; offset < data.length; index++) {
    const slice = data.subarray(offset, offset += chunkLen);
    ixs.push(
      await loadChunk({
        owner,
        chunkHolderId,
        chunk: { data: slice, index },
      }),
    );
  }
  return ixs;
}

export type PassToCpiParams = {
  owner: PublicKey;
  chunkHolderId: number;
  program: PublicKey;
  accounts: AccountMeta[];
  cpiComputeUnits: number;
};

export async function passToCpi(
  {
    owner,
    program,
    chunkHolderId,
    accounts,
    cpiComputeUnits,
  }: PassToCpiParams,
): Promise<InstructionWithCu> {
  const instruction = await CHUNK_LOADER_PROGRAM.methods
    .passToCpi()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder({ owner, chunkHolderId }),
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

export async function closeChunks({
  owner,
  chunkHolderId,
}: CloseChunksParams): Promise<InstructionWithCu> {
  const instruction = await CHUNK_LOADER_PROGRAM.methods
    .closeChunks()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder({ owner, chunkHolderId }),
    })
    .instruction();

  return { instruction, cuLimit: CLOSE_CHUNKS_CU };
}

export async function fetchChunkHolder(
  connection: Connection,
  publicKey: PublicKey,
  commitmentOrConfig?: Commitment | GetAccountInfoConfig,
): Promise<ChunkHolder | null> {
  return await fetchAccount(
    connection,
    CHUNK_LOADER_PROGRAM.coder,
    publicKey,
    "chunkHolder",
    commitmentOrConfig,
  );
}
