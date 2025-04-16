import {
  BlockhashWithExpiryBlockHeight,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  Transaction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

export function setupTests(): { connection: Connection; payer: Keypair } {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);
  const payer = (provider.wallet as NodeWallet).payer;
  return { connection, payer };
}

export async function disperse(
  connection: Connection,
  toPubkeys: PublicKey[],
  fromKeypair: Keypair,
  amount: number,
): Promise<void> {
  const tx = new Transaction();
  for (const toPubkey of toPubkeys) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        lamports: amount,
        toPubkey,
      }),
    );
  }
  await sendAndConfirmTransaction(connection, tx, [fromKeypair]);
}

export async function transfer(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  lamports: number,
): Promise<void> {
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports,
      }),
    ),
    [from],
  );
}

export async function transferEverything(
  connection: Connection,
  fromKeypairs: Keypair[],
  toKeypair: Keypair,
): Promise<void> {
  if (fromKeypairs.length == 0) {
    return;
  }

  const tx = new Transaction();
  for (const fromKeypair of fromKeypairs) {
    const lamports = await connection.getBalance(fromKeypair.publicKey);

    tx.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        lamports,
        toPubkey: toKeypair.publicKey,
      }),
    );
  }

  tx.feePayer = toKeypair.publicKey;

  await sendAndConfirmTransaction(
    connection,
    tx,
    [toKeypair].concat(fromKeypairs),
  );
}

export async function sendAndConfirmVersionedTx(
  connection: Connection,
  tx: Transaction,
  signers: Signer[],
  payerKey: PublicKey,
): Promise<TransactionSignature> {
  const { verTx, latestBlockhash } = await toVersionedTx(
    connection,
    tx,
    payerKey,
  );
  verTx.sign(signers);

  const transactionSignature = await connection
    .sendTransaction(verTx);

  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: transactionSignature,
  });

  return transactionSignature;
}

async function toVersionedTx(
  connection: Connection,
  tx: Transaction,
  payerKey: PublicKey,
): Promise<
  {
    verTx: VersionedTransaction;
    latestBlockhash: BlockhashWithExpiryBlockHeight;
  }
> {
  const latestBlockhash = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: tx.instructions,
  }).compileToV0Message();

  return {
    verTx: new VersionedTransaction(messageV0),
    latestBlockhash,
  };
}
