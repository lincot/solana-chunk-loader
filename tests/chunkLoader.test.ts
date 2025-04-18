import { Keypair, Signer } from "@solana/web3.js";
import { describe, expect, test } from "bun:test";
import { randomBytes, randomInt } from "crypto";
import {
  getChunkLoader,
  InstructionWithCu,
  MAX_CHUNK_LEN,
  toTransaction,
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
const chunkLoader = getChunkLoader(CHUNK_LOADER_PROGRAM);

const owner = new Keypair();
svm.airdrop(owner.publicKey, BigInt(40_000_000_000));

const sendTx = (ixs: InstructionWithCu[], payer: Signer = owner) => {
  const tx = toTransaction(ixs, svm.latestBlockhash(), payer);
  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(
      "Transaction execution failed with " + res.err() + ":\n" +
        res.meta().logs().join("\n"),
    );
  }
};

describe("chunk loader", () => {
  const chunkHolderId = randomInt(1 << 19);

  test("load chunk", async () => {
    const data = Buffer.from(randomBytes(5001));

    const instructions = await chunkLoader.loadByChunks(
      { owner: owner.publicKey, data, chunkHolderId: randomInt(1 << 19) },
      MAX_CHUNK_LEN + 1,
    );
    expect(() => sendTx([instructions[0]])).toThrow("Transaction too large");

    const instructions2 = await chunkLoader.loadByChunks({
      owner: owner.publicKey,
      data,
      chunkHolderId,
    });
    for (const ix of instructions2) {
      sendTx([ix]);
    }

    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder.fetch(
      chunkLoader.findChunkHolder({ owner: owner.publicKey, chunkHolderId }),
    );
    expect(chunkHolder.owner).toEqual(owner.publicKey);

    const sortedChunks = chunkHolder.chunks.sort((a, b) => a.index - b.index);

    expect(sortedChunks.length).toEqual(6);
    const sortedData = Buffer.concat(sortedChunks.map((x) => x.data));
    expect(sortedData).toEqual(data);
  });

  test("close chunks", async () => {
    const ix = await chunkLoader.closeChunks({
      owner: owner.publicKey,
      chunkHolderId,
    });
    sendTx([ix]);

    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder
      .fetchNullable(
        chunkLoader.findChunkHolder({ owner: owner.publicKey, chunkHolderId }),
      );
    expect(chunkHolder).toEqual(null);
  });
});
