import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

class MockWallet {
  public publicKey = PublicKey.default;
  async signTransaction(): Promise<any> {
    throw new Error("Please don't sign with mock wallet");
  }
  async signAllTransactions(): Promise<any[]> {
    throw new Error("Please don't sign with mock wallet");
  }
}

export const mockProvider = new anchor.AnchorProvider(
  new Connection("https://this_is_never_used.blablabla"),
  new MockWallet(),
);
