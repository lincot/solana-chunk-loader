import { Keypair, Transaction } from "@solana/web3.js";
import { describe, expect, test } from "bun:test";
import { randomBytes, randomInt } from "crypto";
import {
  closeChunks,
  findChunkHolder,
  loadByChunks,
  MAX_CHUNK_LEN,
} from "@lincot/solana-chunk-loader";
import { ChunkLoader } from "../target/types/chunk_loader";
import chunkLoaderIdl from "../target/idl/chunk_loader.json";
import { Program } from "@coral-xyz/anchor";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { FailedTransactionMetadata } from "litesvm";

const svm = fromWorkspace(".");
const provider = new LiteSVMProvider(svm);

const CHUNK_LOADER_PROGRAM: Program<ChunkLoader> = new Program(
  chunkLoaderIdl as ChunkLoader,
  provider,
);

const owner = new Keypair();
svm.airdrop(owner.publicKey, BigInt(40_000_000_000));

const sendTx = (tx: Transaction, payer: Keypair) => {
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);
  tx.feePayer = payer.publicKey;
  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(
      "Transaction execution failed with " + res.err() + ":\n" +
        res.meta().logs().join("\n"),
    );
  }
};

describe("chunk loader", () => {
  let chunkHolderId = randomInt(1 << 19);

  test("load chunk", async () => {
    const data = Buffer.from(randomBytes(5001));

    const transactions = await loadByChunks(
      { owner: owner.publicKey, data, chunkHolderId: randomInt(1 << 19) },
      MAX_CHUNK_LEN + 1,
    );

    expect(new Promise(() => sendTx(transactions[0], owner))).rejects
      .toThrow("Transaction too large");

    const transactions2 = await loadByChunks({
      owner: owner.publicKey,
      data,
      chunkHolderId,
    });

    for (const tx of transactions2) {
      sendTx(tx, owner);
    }

    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder.fetch(
      findChunkHolder(owner.publicKey, chunkHolderId),
    );
    expect(chunkHolder.owner).toEqual(owner.publicKey);

    const sortedChunks = chunkHolder.chunks.sort((a, b) => {
      if (a.index < b.index) {
        return -1;
      } else {
        return 1;
      }
    });

    expect(sortedChunks.length).toEqual(6);
    const sortedData = Buffer.concat(sortedChunks.map((x) => x.data));
    expect(sortedData).toEqual(data);
  });

  test("close chunks", async () => {
    const tx = await closeChunks({ owner: owner.publicKey, chunkHolderId });
    sendTx(tx, owner);

    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder
      .fetchNullable(
        findChunkHolder(owner.publicKey, chunkHolderId),
      );
    expect(chunkHolder).toEqual(null);
  });
});
