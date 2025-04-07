import { IdlTypes, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  AccountMeta,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import { ChunkLoader } from "../target/types/chunk_loader";
import { BN } from "bn.js";
import { randomInt } from "crypto";

anchor.setProvider(anchor.AnchorProvider.env());
export const CHUNK_LOADER_PROGRAM: Program<ChunkLoader> =
  anchor.workspace.ChunkLoader;

export type Chunk = IdlTypes<ChunkLoader>["chunk"];

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
  owner: Keypair;
  chunkHolderId: number;
  chunk: Chunk;
};

export async function loadChunk(
  {
    owner,
    chunkHolderId,
    chunk,
  }: LoadChunkInput,
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: LOAD_CHUNK_CU,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .loadChunk(chunkHolderId, chunk)
    .accounts({
      owner: owner.publicKey,
    })
    .preInstructions(preInstructions)
    .signers([owner])
    .transaction();

  tx.signatures = [];
  tx.feePayer = owner.publicKey;

  const transactionSignature = await CHUNK_LOADER_PROGRAM.provider.connection
    .sendTransaction(tx, [owner]);
  const latestBlockHash = await CHUNK_LOADER_PROGRAM.provider.connection
    .getLatestBlockhash();
  await CHUNK_LOADER_PROGRAM.provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: transactionSignature,
  });

  return { transactionSignature };
}

export type LoadByChunksInput = {
  owner: Keypair;
  data: Buffer;
};

export async function loadByChunks({
  owner,
  data,
}: LoadByChunksInput, maxChunkLen = MAX_CHUNK_LEN): Promise<number> {
  const chunkHolderId = randomInt(1 << 19);
  const numExtends = Math.floor(data.length / maxChunkLen);

  const promises = [];
  for (let i = 0; i < numExtends; i++) {
    promises.push(
      loadChunk({
        owner,
        chunk: {
          data: data.subarray(i * maxChunkLen, (i + 1) * maxChunkLen),
          index: i,
        },
        chunkHolderId,
      }),
    );
  }
  promises.push(
    loadChunk({
      owner,
      chunk: {
        data: data.subarray(numExtends * maxChunkLen),
        index: numExtends,
      },
      chunkHolderId: chunkHolderId,
    }),
  );

  await Promise.all(promises);

  return chunkHolderId;
}

export type PassToCpiInput = {
  owner: Keypair;
  chunkHolderId: number;
  program: PublicKey;
  accounts: AccountMeta[];
  signers: Keypair[];
  cpiComputeUnits: number;
};

export async function passToCpi(
  {
    owner,
    program,
    chunkHolderId,
    accounts,
    signers,
    cpiComputeUnits,
  }: PassToCpiInput,
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: PASS_TO_CPI_BASE_CU + cpiComputeUnits,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .passToCpi()
    .accountsStrict({
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkHolderId),
      program,
    })
    .remainingAccounts(accounts)
    .preInstructions(preInstructions)
    .signers(signers.concat([owner]))
    .transaction();

  tx.signatures = [];
  tx.feePayer = owner.publicKey;

  const transactionSignature = await CHUNK_LOADER_PROGRAM.provider.connection
    .sendTransaction(tx, [owner]);
  const latestBlockHash = await CHUNK_LOADER_PROGRAM.provider.connection
    .getLatestBlockhash();
  await CHUNK_LOADER_PROGRAM.provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: transactionSignature,
  });

  return { transactionSignature };
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
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: CLOSE_CHUNKS_CU,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .closeChunks()
    .accountsStrict({
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkHolderId),
    })
    .preInstructions(preInstructions)
    .signers([owner])
    .transaction();

  tx.signatures = [];
  tx.feePayer = owner.publicKey;

  const transactionSignature = await CHUNK_LOADER_PROGRAM.provider.connection
    .sendTransaction(tx, [owner]);
  const latestBlockHash = await CHUNK_LOADER_PROGRAM.provider.connection
    .getLatestBlockhash();
  await CHUNK_LOADER_PROGRAM.provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: transactionSignature,
  });

  return { transactionSignature };
}
