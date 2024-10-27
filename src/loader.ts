import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

require("dotenv").config();

const env = (name: string) => {
  let v = process.env[name] || "";
  v = v.trim().replace(/^["']+|["']+$/g, "");
  if (!v) throw new Error(`${name} env variable is required`);
  return v;
};

export const MAINNET_RPC_URL = env("MAINNET_RPC_URL");
export const MAIN_WALLET_SECRET_KEY = env("MAIN_WALLET_SECRET_KEY");

export const mainWallet = Keypair.fromSecretKey(
  bs58.decode(MAIN_WALLET_SECRET_KEY)
);
export const connection = new Connection(MAINNET_RPC_URL);
