/**
 * Real Merkle tree using SHA-256 — proper binary tree with inclusion proofs.
 * This is genuine cryptography, not a simulation.
 */

import { createHash } from "crypto";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hashPair(left: string, right: string): string {
  return sha256(left + right);
}

function hashLeaf(value: string): string {
  return sha256("\x00" + value);
}

export interface MerkleProof {
  /** Sibling hashes from leaf to root */
  siblings: string[];
  /** Direction of each sibling: true = right, false = left */
  directions: boolean[];
}

export class MerkleTree {
  private leaves: string[] = [];
  private leafHashes: string[] = [];
  private levels: string[][] = []; // levels[0] = leaf hashes, levels[last] = [root]

  /** Add a leaf (will be hashed). */
  addLeaf(value: string): number {
    this.leaves.push(value);
    this.leafHashes.push(hashLeaf(value));
    return this.leaves.length - 1;
  }

  /** Build the tree from current leaves. */
  build(): void {
    if (this.leafHashes.length === 0) {
      this.levels = [[sha256("")]];
      return;
    }

    this.levels = [[...this.leafHashes]];

    let currentLevel = [...this.leafHashes];
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
        nextLevel.push(hashPair(left, right));
      }
      this.levels.push(nextLevel);
      currentLevel = nextLevel;
    }
  }

  /** Get the Merkle root. */
  getRoot(): string {
    if (this.levels.length === 0) this.build();
    return this.levels[this.levels.length - 1][0];
  }

  /** Generate inclusion proof for leaf at index. */
  getProof(index: number): MerkleProof | null {
    if (index < 0 || index >= this.leaves.length) return null;
    if (this.levels.length === 0) this.build();

    const siblings: string[] = [];
    const directions: boolean[] = [];
    let idx = index;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const levelNodes = this.levels[level];

      if (siblingIdx < levelNodes.length) {
        siblings.push(levelNodes[siblingIdx]);
        directions.push(!isRight); // true = sibling is on the right
      } else {
        // No sibling — duplicate self
        siblings.push(levelNodes[idx]);
        directions.push(true);
      }
      idx = Math.floor(idx / 2);
    }

    return { siblings, directions };
  }

  get leafCount(): number {
    return this.leaves.length;
  }

  getLeafValue(index: number): string | undefined {
    return this.leaves[index];
  }

  getLeafHash(index: number): string | undefined {
    return this.leafHashes[index];
  }
}

/** Verify an inclusion proof against a known root. */
export function verifyMerkleProof(
  leafValue: string,
  proof: MerkleProof,
  root: string,
): boolean {
  let currentHash = hashLeaf(leafValue);

  for (let i = 0; i < proof.siblings.length; i++) {
    if (proof.directions[i]) {
      // Sibling is on the right
      currentHash = hashPair(currentHash, proof.siblings[i]);
    } else {
      // Sibling is on the left
      currentHash = hashPair(proof.siblings[i], currentHash);
    }
  }

  return currentHash === root;
}

/** Build a Merkle root from an array of items. */
export function buildMerkleRoot(items: string[]): string {
  const tree = new MerkleTree();
  for (const item of items) tree.addLeaf(item);
  tree.build();
  return tree.getRoot();
}

/** Build a Merkle tree and get proof for a specific index. */
export function buildMerkleWithProof(
  items: string[],
  proveIndex: number,
): { root: string; proof: MerkleProof | null; tree: MerkleTree } {
  const tree = new MerkleTree();
  for (const item of items) tree.addLeaf(item);
  tree.build();
  return { root: tree.getRoot(), proof: tree.getProof(proveIndex), tree };
}
