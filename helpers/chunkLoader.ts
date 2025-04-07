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

export const findChunkHolder = (owner: PublicKey, chunkId: number) =>
  PublicKey.findProgramAddressSync([
    Buffer.from("CHUNK_HOLDER"),
    owner.toBuffer(),
    new BN(chunkId).toArrayLike(Buffer, "le", 4),
  ], CHUNK_LOADER_PROGRAM.programId)[0];

export type LoadChunkInput = {
  owner: Keypair;
  chunkId: number;
  chunk: Chunk;
};

export async function loadChunk(
  {
    owner,
    chunkId,
    chunk,
  }: LoadChunkInput,
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: LOAD_CHUNK_CU,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .loadChunk(chunkId, chunk)
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
  const chunkId = randomInt(1 << 19);
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
        chunkId,
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
      chunkId,
    }),
  );

  await Promise.all(promises);

  return chunkId;
}

export type PassToCpiInput = {
  owner: Keypair;
  chunkId: number;
  program: PublicKey;
  accounts: AccountMeta[];
  signers: Keypair[];
  computeUnits: number;
};

export async function passToCpi(
  {
    owner,
    program,
    chunkId,
    accounts,
    signers,
    computeUnits,
  }: PassToCpiInput,
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnits,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .passToCpi()
    .accountsStrict({
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkId),
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
  chunkId: number;
};

export async function closeChunks(
  {
    owner,
    chunkId,
  }: CloseChunksInput,
): Promise<{ transactionSignature: TransactionSignature }> {
  const preInstructions = [ComputeBudgetProgram.setComputeUnitLimit({
    units: CLOSE_CHUNKS_CU,
  })];

  const tx = await CHUNK_LOADER_PROGRAM.methods
    .closeChunks()
    .accountsStrict({
      owner: owner.publicKey,
      chunkHolder: findChunkHolder(owner.publicKey, chunkId),
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
