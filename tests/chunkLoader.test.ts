import { Keypair } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  disperse,
  sendAndConfirmVersionedTx,
  setupTests,
  transferEverything,
} from "../helpers/utils";
import { randomBytes } from "crypto";
import {
  CHUNK_LOADER_PROGRAM,
  closeChunks,
  findChunkHolder,
  loadByChunks,
  MAX_CHUNK_LEN,
} from "../helpers/chunkLoader";
import { sleep } from "bun";

const owner = new Keypair();
const { connection, payer } = setupTests();

beforeAll(async () => {
  await disperse(
    connection,
    [owner.publicKey],
    payer,
    200_000_000,
  );
});

afterAll(async () => {
  await transferEverything(connection, [owner], payer);
});

describe("chunk loader", () => {
  let chunkHolderId: number;

  test("load chunk", async () => {
    const data = Buffer.from(randomBytes(5001));

    const { transactions } = await loadByChunks(
      { owner, data },
      MAX_CHUNK_LEN + 1,
    );
    expect(sendAndConfirmVersionedTx(
      connection,
      transactions[0],
      [owner],
      owner.publicKey,
    )).rejects.toThrow(
      "Transaction too large",
    );

    const { transactions: transactions2, chunkHolderId: chunkHolderId2 } =
      await loadByChunks({
        owner,
        data,
      });
    chunkHolderId = chunkHolderId2;

    await Promise.all(transactions2.map((tx) =>
      sendAndConfirmVersionedTx(
        connection,
        tx,
        [owner],
        owner.publicKey,
      )
    ));

    await sleep(2000);
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
    const tx = await closeChunks({ owner, chunkHolderId });

    await sendAndConfirmVersionedTx(
      connection,
      tx,
      [owner],
      owner.publicKey,
    );
    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder
      .fetchNullable(
        findChunkHolder(owner.publicKey, chunkHolderId),
      );
    expect(chunkHolder).toEqual(null);
  });
});
