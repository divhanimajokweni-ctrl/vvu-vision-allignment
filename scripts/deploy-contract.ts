// scripts/deploy-contract.ts — Deploy VVUAnchor to Polygon Amoy testnet
//
// Usage:
//   POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com/ \
//   OPERATOR_PRIVATE_KEY=0x... \
//   npx tsx scripts/deploy-contract.ts
//
// Conservative execution: deploys immutable contract, no proxy, no admin keys.
// The contract holds no value. Maximum loss = gas spent.

import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com/";
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const CHAIN_ID = 80002; // Polygon Amoy

if (!PRIVATE_KEY) {
  console.error("ERROR: OPERATOR_PRIVATE_KEY env var required");
  console.error("Generate one with: node -e \"const {ethers}=require('ethers'); console.log(ethers.Wallet.createRandom().privateKey)\"");
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

  console.log("=== VVUAnchor Deployment ===");
  console.log("Network: Polygon Amoy (chainId:", CHAIN_ID, ")");
  console.log("RPC:", RPC_URL);
  console.log("Operator:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");

  if (balance === 0n) {
    console.error("ERROR: Wallet has no MATIC. Fund it from https://faucet.polygon.technology/");
    console.error("Address:", wallet.address);
    process.exit(1);
  }

  // Load compiled artifacts
  const abi = JSON.parse(readFileSync(resolve("contracts/compiled/VVUAnchor.abi"), "utf8"));
  const bytecode = "0x" + readFileSync(resolve("contracts/compiled/VVUAnchor.bin"), "utf8").trim();

  // Stream ID: keccak256 of the tenant code
  const streamId = ethers.keccak256(ethers.toUtf8Bytes("VVU_202625905307"));
  console.log("Stream ID:", streamId);

  // Deploy
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log("Deploying VVUAnchor...");
  const contract = await factory.deploy(streamId, wallet.address);

  console.log("Tx hash:", contract.deploymentTransaction()?.hash);
  console.log("Waiting for confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("=== DEPLOYED ===");
  console.log("Contract address:", address);
  console.log("Explorer:", `https://amoy.polygonscan.com/address/${address}`);

  // Verify
  const code = await provider.getCode(address);
  console.log("Bytecode deployed:", code.length > 2 ? "YES" : "NO");

  const isInit = await contract.isInitialized(streamId);
  console.log("Stream initialized:", isInit);

  // Save deployment info
  const deployment = {
    network: "polygon-amoy",
    chainId: CHAIN_ID,
    contractAddress: address,
    txHash: contract.deploymentTransaction()?.hash,
    operator: wallet.address,
    streamId,
    deployedAt: new Date().toISOString(),
    abi: abi,
  };

  const { writeFileSync } = await import("node:fs");
  writeFileSync("contracts/deployment.json", JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to contracts/deployment.json");
}

main().catch((err) => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
