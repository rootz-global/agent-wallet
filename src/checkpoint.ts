/**
 * Checkpoint / Resume — State persistence for portable agents
 *
 * An agent can checkpoint its state to a Note on its Sovereign Secret.
 * Any attested instance can resume from the latest checkpoint.
 *
 * Anti-replay: monotonic nonce (must increase)
 * Anti-fork: two checkpoints at same height = detectable conflict
 *
 * The checkpoint is the "save game" for the agent. The Secret is
 * the save file. Any hardware can load it.
 */

import { createHash } from 'node:crypto';

/** Checkpoint data written as a Note */
export interface WalletCheckpoint {
  type: 'agent-wallet-checkpoint';
  version: '1.0';
  /** Agent wallet address */
  agentAddress: string;
  /** Hash of the action chain (last action hash) */
  chainHash: string;
  /** Number of actions recorded */
  actionCount: number;
  /** Total tokens across all actions */
  totalTokens: number;
  /** Model used */
  model: string;
  /** Scope */
  scope: string;
  /** Monotonically increasing (anti-replay) */
  nonce: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** SHA-256 hash of the full wallet state */
  stateHash: string;
}

/** Resume data loaded from a checkpoint Note */
export interface ResumeData {
  checkpoint: WalletCheckpoint;
  /** Whether the checkpoint was validated */
  valid: boolean;
  /** Validation errors (if any) */
  errors: string[];
}

/**
 * Create a checkpoint from wallet state.
 */
export function createCheckpoint(
  agentAddress: string,
  chainHash: string,
  actionCount: number,
  totalTokens: number,
  model: string,
  scope: string,
  previousNonce: number,
): WalletCheckpoint {
  const nonce = previousNonce + 1;

  const stateData = JSON.stringify({
    agentAddress, chainHash, actionCount, totalTokens, model, scope, nonce,
  });
  const stateHash = '0x' + createHash('sha256').update(stateData).digest('hex');

  return {
    type: 'agent-wallet-checkpoint',
    version: '1.0',
    agentAddress,
    chainHash,
    actionCount,
    totalTokens,
    model,
    scope,
    nonce,
    timestamp: new Date().toISOString(),
    stateHash,
  };
}

/**
 * Validate a checkpoint before resuming from it.
 *
 * Checks:
 * 1. Type and version match
 * 2. Agent address matches expected
 * 3. Nonce is greater than minimum (anti-replay)
 * 4. State hash is consistent
 */
export function validateCheckpoint(
  checkpoint: WalletCheckpoint,
  expectedAgentAddress: string,
  minimumNonce: number = 0,
): ResumeData {
  const errors: string[] = [];

  if (checkpoint.type !== 'agent-wallet-checkpoint') {
    errors.push(`Invalid type: ${checkpoint.type}`);
  }
  if (checkpoint.version !== '1.0') {
    errors.push(`Unsupported version: ${checkpoint.version}`);
  }
  if (checkpoint.agentAddress !== expectedAgentAddress) {
    errors.push(`Agent address mismatch: expected ${expectedAgentAddress}, got ${checkpoint.agentAddress}`);
  }
  if (checkpoint.nonce <= minimumNonce) {
    errors.push(`Stale nonce: ${checkpoint.nonce} <= ${minimumNonce} (anti-replay)`);
  }

  // Verify state hash
  const stateData = JSON.stringify({
    agentAddress: checkpoint.agentAddress,
    chainHash: checkpoint.chainHash,
    actionCount: checkpoint.actionCount,
    totalTokens: checkpoint.totalTokens,
    model: checkpoint.model,
    scope: checkpoint.scope,
    nonce: checkpoint.nonce,
  });
  const expectedHash = '0x' + createHash('sha256').update(stateData).digest('hex');
  if (checkpoint.stateHash !== expectedHash) {
    errors.push(`State hash mismatch: checkpoint may be tampered`);
  }

  return {
    checkpoint,
    valid: errors.length === 0,
    errors,
  };
}
