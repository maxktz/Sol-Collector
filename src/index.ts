import * as fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type BlockhashWithExpiryBlockHeight,
} from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { connection, mainWallet } from "./loader";
import logger from "./logger";
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// const balances = accounts.value.map((account) => {
//   return {
//     mint: account.account.data.parsed.info.mint,
//     amount: account.account.data.parsed.info.tokenAmount.uiAmount,
//   };
// });

async function cashoutWallet(
  connection: Connection,
  fromOwner: Keypair,
  destination: PublicKey,
  feePayer: Keypair,
  blockhash?: string
) {
  // Get SOL balance
  const balance = await connection.getBalance(fromOwner.publicKey);

  // Get all token accounts owned by fromWallet
  const accounts = await connection.getParsedTokenAccountsByOwner(
    fromOwner.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  // Create transaction
  let transaction = new Transaction();

  // Add token transfer and close instructions for each token account
  for (const { pubkey: fromTokenAccount, account } of accounts.value) {
    const accountInfo = account.data.parsed.info;
    const mintAddress = new PublicKey(accountInfo.mint);
    const amount = BigInt(accountInfo.tokenAmount.amount);

    if (amount > 0n) {
      // Get the destination associated token account
      const toTokenAccount = getAssociatedTokenAddressSync(
        mintAddress,
        destination
      );

      // Check if destination token account exists
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

      if (!toAccountInfo) {
        // Create associated token account if it doesn't exist
        const createAccIx = createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          toTokenAccount,
          destination,
          mintAddress
        );
        transaction.add(createAccIx);
      }

      // Transfer all tokens
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromOwner.publicKey,
          amount
        )
      );
    }

    // Close the source token account
    transaction.add(
      createCloseAccountInstruction(
        fromTokenAccount,
        destination,
        fromOwner.publicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // Transfer all SOL minus rent for transaction
  if (balance > 0) {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: fromOwner.publicKey,
        toPubkey: destination,
        lamports: balance,
      })
    );
  }
  if (transaction.instructions.length === 0) {
    return;
  }

  // Set fee payer
  transaction.feePayer = feePayer.publicKey;

  // Get recent blockhash
  if (blockhash === undefined) {
    let latestBlockhash = await connection.getLatestBlockhash();
    blockhash = latestBlockhash.blockhash;
  }
  transaction.recentBlockhash = blockhash;

  // Sign transaction
  transaction.sign(fromOwner, feePayer);

  // Send transaction
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  return signature;
}

(async () => {
  // Read secret keys from file
  const secret_keys = fs
    .readFileSync("wallets.txt", "utf-8")
    .split("\n")
    .filter(Boolean);

  for (const secret_key of secret_keys) {
    const wallet = Keypair.fromSecretKey(bs58.decode(secret_key));

    logger.info(`Cashing out owner: ${wallet.publicKey.toBase58()}`);
    const signature = await cashoutWallet(
      connection,
      wallet,
      mainWallet.publicKey,
      mainWallet
    );
    if (signature) {
      logger.info(`Transaction signature: ${signature}`);
    }
  }
})();
