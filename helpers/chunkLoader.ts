import * as anchor from "@coral-xyz/anchor";
import { IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { ChunkLoader } from "../target/types/chunk_loader";
import { BN } from "bn.js";
import { randomInt } from "crypto";

export const CHUNK_LOADER_PROGRAM: Program<ChunkLoader> =
  anchor.workspace.ChunkLoader;

export type Chunk = IdlTypes<ChunkLoader>["chunk"];

export const MAX_CHUNK_LEN = 943;
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
  owner: Keypair;
  chunkHolderId: number;
  chunk: Chunk;
};

export function loadChunk(
  {
    owner,
    chunkHolderId,
    chunk,
  }: LoadChunkInput,
): Promise<Transaction> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: LOAD_CHUNK_CU,
  })];

  return CHUNK_LOADER_PROGRAM.methods
    .loadChunk(chunkHolderId, chunk)
    .accounts({
      owner: owner.publicKey,
    })
    .preInstructions(preInstructions)
    .transaction();
}

export type LoadByChunksInput = {
  owner: Keypair;
  data: Buffer;
};

export async function loadByChunks({
  owner,
  data,
}: LoadByChunksInput, maxChunkLen = MAX_CHUNK_LEN): Promise<{
  transactions: Transaction[];
  chunkHolderId: number;
}> {
  const chunkHolderId = randomInt(1 << 19);
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

  return { transactions, chunkHolderId };
}

export type PassToCpiInput = {
  owner: Keypair;
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
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkHolderId),
      program,
    })
    .remainingAccounts(accounts)
    .preInstructions(preInstructions)
    .transaction();
}

export type CloseChunksInput = {
  owner: Keypair;
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
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkHolderId),
    })
    .preInstructions(preInstructions)
    .transaction();
}
