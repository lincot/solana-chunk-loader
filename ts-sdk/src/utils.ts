import { Coder } from "@coral-xyz/anchor";
import {
  Commitment,
  ComputeBudgetProgram,
  Connection,
  GetAccountInfoConfig,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const createStubObject = (errorMsg: string) => {
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (typeof prop === "symbol") return undefined;
      return new Proxy(() => {}, handler);
    },
    apply() {
      throw new Error(errorMsg);
    },
  };

  return new Proxy({}, handler);
};

export type InstructionWithCu = {
  instruction: TransactionInstruction;
  cuLimit: number;
};

export const cuLimitInstruction = (ixs: InstructionWithCu[]) =>
  ComputeBudgetProgram.setComputeUnitLimit({
    units: ixs.reduce((n, { cuLimit }) => n + cuLimit, 0),
  });

export const toTransaction = (
  ixs: InstructionWithCu[],
  recentBlockhash: string,
  feePayer: Signer,
) => {
  const tx = new Transaction()
    .add(cuLimitInstruction(ixs), ...ixs.map((x) => x.instruction));
  tx.recentBlockhash = recentBlockhash;
  tx.feePayer = feePayer.publicKey;
  tx.sign(feePayer);
  return tx;
};

export async function fetchAccount<T>(
  connection: Connection,
  coder: Coder<string, string>,
  publicKey: PublicKey,
  accountName: string,
  commitmentOrConfig?: Commitment | GetAccountInfoConfig,
): Promise<T | null> {
  const acc = await connection.getAccountInfo(publicKey, commitmentOrConfig);

  if (!acc || acc.data === null || acc.data.length === 0) {
    return null;
  }

  return coder.accounts.decode<T>(accountName, acc.data);
}
