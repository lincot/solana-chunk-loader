import { Keypair } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { disperse, setupTests, transferEverything } from "../helpers/utils";
import { randomBytes } from "crypto";
import {
  CHUNK_LOADER_PROGRAM,
  closeChunks,
  findChunkHolder,
  loadByChunks,
  MAX_CHUNK_LEN,
} from "../helpers/chunkLoader";

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

    expect(loadByChunks({ owner, data }, MAX_CHUNK_LEN + 1)).rejects.toThrow(
      "Transaction too large",
    );
    chunkHolderId = await loadByChunks({ owner, data });

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
    await closeChunks({ owner, chunkHolderId });
    const chunkHolder = await CHUNK_LOADER_PROGRAM.account.chunkHolder
      .fetchNullable(
        findChunkHolder(owner.publicKey, chunkHolderId),
      );
    expect(chunkHolder).toEqual(null);
  });
});
