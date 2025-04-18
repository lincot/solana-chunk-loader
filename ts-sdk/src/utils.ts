import { AnchorProvider } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const mockWallet = {
  publicKey: PublicKey.default,
  async signTransaction(): Promise<any> {
    throw new Error("Please don't sign with mock wallet");
  },
  async signAllTransactions(): Promise<any[]> {
    throw new Error("Please don't sign with mock wallet");
  },
};

export const mockProvider = new AnchorProvider(
  new Connection("https://this_is_never_used.blablabla"),
  mockWallet,
);

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
