import { IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { ChunkLoader } from "./idl/chunk_loader";
import chunkLoaderIdl from "./idl/chunk_loader.json";
import { BN } from "bn.js";
import { mockProvider } from "./utils";

const CHUNK_LOADER_PROGRAM: Program<ChunkLoader> = new Program(
  chunkLoaderIdl as ChunkLoader,
  mockProvider,
);

export type Chunk = IdlTypes<ChunkLoader>["chunk"];

/**
 * Maximum chunk length when sending legacy transactions.
 */
export const MAX_CHUNK_LEN = 945;
const LOAD_CHUNK_CU = 15_000;
const CLOSE_CHUNKS_CU = 10_000;
const PASS_TO_CPI_BASE_CU = 10_000;

export const findChunkHolder = (owner: PublicKey, chunkHolderId: number) =>
  PublicKey.findProgramAddressSync([
    Buffer.from("CHUNK_HOLDER"),
    owner.toBuffer(),
    new BN(chunkHolderId).toArrayLike(Buffer, "le", 4),
  ], CHUNK_LOADER_PROGRAM.programId)[0];

export type LoadChunkInput = {
  owner: PublicKey;
  chunkHolderId: number;
  chunk: Chunk;
};

export async function loadChunk(
  {
    owner,
    chunkHolderId,
    chunk,
  }: LoadChunkInput,
): Promise<Transaction> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: LOAD_CHUNK_CU,
  })];

  return await CHUNK_LOADER_PROGRAM.methods
    .loadChunk(chunkHolderId, chunk)
    .accounts({ owner })
    .preInstructions(preInstructions)
    .transaction();
}

export type LoadByChunksInput = {
  owner: PublicKey;
  data: Buffer;
  chunkHolderId: number;
};

export async function loadByChunks({
  owner,
  data,
  chunkHolderId,
}: LoadByChunksInput, maxChunkLen = MAX_CHUNK_LEN): Promise<Transaction[]> {
  const numExtends = Math.floor(data.length / maxChunkLen);

  const transactions = [];
  for (let i = 0; i < numExtends; i++) {
    transactions.push(
      await loadChunk({
        owner,
        chunk: {
          data: data.subarray(i * maxChunkLen, (i + 1) * maxChunkLen),
          index: i,
        },
        chunkHolderId,
      }),
    );
  }
  transactions.push(
    await loadChunk({
      owner,
      chunk: {
        data: data.subarray(numExtends * maxChunkLen),
        index: numExtends,
      },
      chunkHolderId: chunkHolderId,
    }),
  );

  return transactions;
}

export type PassToCpiInput = {
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
  }: PassToCpiInput,
): Promise<Transaction> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: PASS_TO_CPI_BASE_CU + cpiComputeUnits,
  })];

  return await CHUNK_LOADER_PROGRAM.methods
    .passToCpi()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder(owner, chunkHolderId),
      program,
    })
    .remainingAccounts(accounts)
    .preInstructions(preInstructions)
    .transaction();
}

export type CloseChunksInput = {
  owner: PublicKey;
  chunkHolderId: number;
};

export async function closeChunks(
  {
    owner,
    chunkHolderId,
  }: CloseChunksInput,
): Promise<Transaction> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: CLOSE_CHUNKS_CU,
  })];

  return await CHUNK_LOADER_PROGRAM.methods
    .closeChunks()
    .accountsStrict({
      owner,
      chunkHolder: findChunkHolder(owner, chunkHolderId),
    })
    .preInstructions(preInstructions)
    .transaction();
}
