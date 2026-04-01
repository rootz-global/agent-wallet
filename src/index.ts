/**
 * @rootz/agent-wallet — SDK for AI Agents with Provable Origin
 *
 * npm install @rootz/agent-wallet
 *
 * Create an agent wallet. Give it a birth certificate. Record every action.
 * Settle to chain. Archive to IPFS. Recover from one address.
 *
 * Usage:
 *   const wallet = await createAgentWallet({ ownerAddress, model, scope });
 *   await wallet.recordInference({ prompt, response, model, tokens });
 *   const settlement = await wallet.settle();
 *
 * The wallet IS the agent. The chain IS its history. The archive IS its memory.
 */

import { createHash } from 'node:crypto';
import { ethers } from 'ethers';

// Note: When workspace linking is complete, re-export from @rootz/agent-runtime.
// For now, this SDK is standalone — all types needed are defined here or inline.

// ═══════════════════════════════════════════════════════════════════
// AGENT WALLET — The simple API
// ═══════════════════════════════════════════════════════════════════

/** Configuration for creating an agent wallet */
export interface CreateWalletConfig {
  /** Owner/authorizer wallet address (the key holder) */
  ownerAddress: string;
  /** Owner's human-readable name (optional) */
  ownerName?: string;
  /** AI model that powers this agent */
  model: string;
  /** AI provider (e.g., 'morpheus', 'openai', 'anthropic') */
  provider?: string;
  /** API endpoint */
  apiEndpoint?: string;
  /** Agent scope (e.g., 'research', 'healthcare', 'finance') */
  scope: string;
  /** Daily spending allowance */
  dailyAllowance?: number;
  /** Currency for allowance */
  currency?: string;
  /** BIP-32 derivation index for this agent */
  agentIndex?: number;
}

/** Recorded inference call */
export interface InferenceRecord {
  /** Full prompt text */
  prompt: string;
  /** System prompt (optional) */
  systemPrompt?: string;
  /** Full response text */
  response: string;
  /** Model that generated the response */
  model: string;
  /** Token counts */
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Latency in milliseconds */
  latencyMs: number;
}

/** Settlement result */
export interface SettlementResult {
  /** Merkle root covering all actions */
  merkleRoot: string;
  /** Number of actions settled */
  actionCount: number;
  /** Total tokens in session */
  totalTokens: number;
  /** Full session content (markdown, for archiving) */
  archiveContent: string;
  /** Timestamp */
  timestamp: string;
}

/** Agent wallet state */
export interface WalletState {
  agentAddress: string;
  ownerAddress: string;
  model: string;
  scope: string;
  actionCount: number;
  totalTokens: number;
  lastHash: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// THE WALLET
// ═══════════════════════════════════════════════════════════════════

export class AgentWallet {
  private config: CreateWalletConfig;
  private actions: Array<InferenceRecord & { promptHash: string; responseHash: string; previousHash: string; timestamp: string }> = [];
  private lastHash: string = '0x' + '0'.repeat(64);
  private totalTokens: number = 0;
  private agentAddress: string;
  private createdAt: string;

  private constructor(config: CreateWalletConfig, agentAddress: string) {
    this.config = config;
    this.agentAddress = agentAddress;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Create a new agent wallet with a birth certificate.
   *
   * This is the entry point. One call creates the agent identity.
   */
  static create(config: CreateWalletConfig): AgentWallet {
    // Derive agent address from index (or generate)
    const index = config.agentIndex ?? 0;
    const path = `m/44'/60'/0'/1/${index}`;

    // For standalone mode, generate a deterministic address from config
    const configHash = createHash('sha256')
      .update(JSON.stringify({ owner: config.ownerAddress, scope: config.scope, index }))
      .digest('hex');
    const agentAddress = '0x' + configHash.slice(0, 40);

    const wallet = new AgentWallet(config, agentAddress);

    console.error(`[AgentWallet] Created: ${agentAddress}`);
    console.error(`[AgentWallet] Owner: ${config.ownerAddress}`);
    console.error(`[AgentWallet] Model: ${config.model}`);
    console.error(`[AgentWallet] Scope: ${config.scope}`);

    return wallet;
  }

  /**
   * Get the birth certificate for this agent.
   */
  getBirthCertificate(): Record<string, unknown> {
    return {
      type: 'agent-birth-certificate',
      version: '1.0',
      agent: {
        address: this.agentAddress,
        derivationPath: `m/44'/60'/0'/1/${this.config.agentIndex ?? 0}`,
        created: this.createdAt,
      },
      parents: {
        ai: {
          factory: this.config.provider ?? 'unknown',
          model: this.config.model,
          apiEndpoint: this.config.apiEndpoint ?? '',
        },
        authorizer: {
          address: this.config.ownerAddress,
          name: this.config.ownerName,
        },
      },
      policy: {
        dailyAllowance: this.config.dailyAllowance ?? 100,
        currency: this.config.currency ?? 'USD',
        models: [this.config.model],
        scope: this.config.scope,
      },
    };
  }

  /**
   * Record an inference call.
   * Hashes the prompt and response, links to previous action.
   */
  recordInference(record: InferenceRecord): {
    promptHash: string;
    responseHash: string;
    previousHash: string;
    actionIndex: number;
  } {
    const promptHash = '0x' + createHash('sha256').update(record.prompt).digest('hex');
    const responseHash = '0x' + createHash('sha256').update(record.response).digest('hex');
    const previousHash = this.lastHash;

    this.actions.push({
      ...record,
      promptHash,
      responseHash,
      previousHash,
      timestamp: new Date().toISOString(),
    });

    this.lastHash = '0x' + createHash('sha256')
      .update(JSON.stringify({ promptHash, responseHash, previousHash }))
      .digest('hex');

    this.totalTokens += record.totalTokens;

    return {
      promptHash,
      responseHash,
      previousHash,
      actionIndex: this.actions.length - 1,
    };
  }

  /**
   * Settle the session — compute Merkle root and build archive content.
   * Returns the settlement data ready to write to chain.
   */
  settle(): SettlementResult {
    // Compute Merkle root (simplified: hash of last action hash)
    const merkleRoot = this.lastHash;

    // Build archive content
    const archiveContent = this.buildArchiveContent(merkleRoot);

    const result: SettlementResult = {
      merkleRoot,
      actionCount: this.actions.length,
      totalTokens: this.totalTokens,
      archiveContent,
      timestamp: new Date().toISOString(),
    };

    console.error(`[AgentWallet] Settled: ${this.actions.length} actions, ${this.totalTokens} tokens`);

    return result;
  }

  /** Get current wallet state */
  getState(): WalletState {
    return {
      agentAddress: this.agentAddress,
      ownerAddress: this.config.ownerAddress,
      model: this.config.model,
      scope: this.config.scope,
      actionCount: this.actions.length,
      totalTokens: this.totalTokens,
      lastHash: this.lastHash,
      createdAt: this.createdAt,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private buildArchiveContent(merkleRoot: string): string {
    const lines: string[] = [];

    lines.push(`# Agent Session — ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('## Metadata');
    lines.push(`- **Agent**: ${this.agentAddress}`);
    lines.push(`- **Owner**: ${this.config.ownerAddress}`);
    lines.push(`- **Model**: ${this.config.model}`);
    lines.push(`- **Scope**: ${this.config.scope}`);
    lines.push(`- **Total Tokens**: ${this.totalTokens}`);
    lines.push(`- **Merkle Root**: ${merkleRoot}`);
    lines.push('');

    lines.push('## Actions');
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];
      lines.push('');
      lines.push(`### Action ${i + 1}: inference`);
      lines.push(`- **Prompt Hash**: \`${action.promptHash}\``);
      lines.push(`- **Response Hash**: \`${action.responseHash}\``);
      lines.push(`- **Previous Hash**: \`${action.previousHash}\``);
      lines.push(`- **Model**: ${action.model}`);
      lines.push(`- **Tokens**: ${action.totalTokens}`);
      lines.push(`- **Latency**: ${action.latencyMs}ms`);
      lines.push('');
      if (action.systemPrompt) {
        lines.push('**System Prompt**:');
        lines.push(action.systemPrompt);
        lines.push('');
      }
      lines.push('**Prompt**:');
      lines.push(action.prompt);
      lines.push('');
      lines.push('**Response**:');
      lines.push(action.response);
    }

    lines.push('');
    lines.push('## Settlement');
    lines.push(`- **Merkle Root**: \`${merkleRoot}\``);
    lines.push(`- **Actions**: ${this.actions.length}`);
    lines.push(`- **Total Tokens**: ${this.totalTokens}`);

    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an agent wallet. The simplest entry point.
 *
 * @example
 * const wallet = createAgentWallet({
 *   ownerAddress: '0xYourWallet...',
 *   model: 'gpt-4',
 *   scope: 'research',
 * });
 */
export function createAgentWallet(config: CreateWalletConfig): AgentWallet {
  return AgentWallet.create(config);
}
