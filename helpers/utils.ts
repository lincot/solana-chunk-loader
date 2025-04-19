import {
  AccountInfo,
  Commitment,
  GetAccountInfoConfig,
  PublicKey,
} from "@solana/web3.js";
import { LiteSVM } from "litesvm";

export class LiteSVMConnection {
  constructor(private client: LiteSVM) {}

  async getAccountInfo(
    publicKey: PublicKey,
    _commitmentOrConfig?: Commitment | GetAccountInfoConfig | undefined,
  ): Promise<AccountInfo<Buffer>> {
    const accountInfoBytes = this.client.getAccount(publicKey);
    if (!accountInfoBytes) {
      throw new Error(`Could not find ${publicKey.toBase58()}`);
    }
    return {
      ...accountInfoBytes,
      data: Buffer.from(accountInfoBytes.data),
    };
  }
}
