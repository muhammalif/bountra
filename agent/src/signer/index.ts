import {
  encodePacked,
  keccak256,
  hashMessage,
  recoverMessageAddress,
  type Address,
  type Hex,
  getAddress
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface ClaimDigestParams {
  bountyId: bigint | number;
  devWallet: Address;
  commitHash: string;
  prUrl: string;
  contractAddress: Address;
  chainId: bigint | number;
}

/**
 * Computes raw keccak256(abi.encodePacked(bountyId, devWallet, commitHash, prUrl, contractAddress, chainId))
 */
export function computeRawClaimHash(params: ClaimDigestParams): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "address", "string", "string", "address", "uint256"],
      [
        BigInt(params.bountyId),
        getAddress(params.devWallet),
        params.commitHash,
        params.prUrl,
        getAddress(params.contractAddress),
        BigInt(params.chainId)
      ]
    )
  );
}

/**
 * Computes Ethereum Signed Message Hash matching OpenZeppelin MessageHashUtils.toEthSignedMessageHash
 */
export function computeClaimDigest(params: ClaimDigestParams): Hex {
  const rawHash = computeRawClaimHash(params);
  return hashMessage({ raw: rawHash });
}

/**
 * Signs the bounty claim payload using the Agent's private key.
 * Produces an ECDSA signature acceptable by BountraEscrow.sol claimBounty().
 */
export async function signBountyClaim(
  params: ClaimDigestParams,
  privateKey: Hex
): Promise<{ signature: Hex; rawHash: Hex; digest: Hex; agentAddress: Address }> {
  const account = privateKeyToAccount(privateKey);
  const rawHash = computeRawClaimHash(params);
  const digest = hashMessage({ raw: rawHash });

  const signature = await account.signMessage({
    message: { raw: rawHash }
  });

  return {
    signature,
    rawHash,
    digest,
    agentAddress: account.address
  };
}

/**
 * Recovers the signer address from an ECDSA signature and raw claim parameters.
 */
export async function verifyClaimSignature(
  params: ClaimDigestParams,
  signature: Hex
): Promise<Address> {
  const rawHash = computeRawClaimHash(params);
  return recoverMessageAddress({
    message: { raw: rawHash },
    signature
  });
}

/**
 * Resolves the agent's signing key, or throws.
 *
 * The previous code fell back to Anvil account #0 when AGENT_PRIVATE_KEY was
 * unset. That key is published in every Foundry/Anvil tutorial, so a
 * misconfigured deployment would happily produce signatures that look valid and
 * verify on-chain against a publicly known key. Refusing to start is the only
 * safe failure mode for a key whose only job is authorizing fund movement.
 */
export function requireAgentSigningKey(): Hex {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not set. The agent refuses to sign claims without an explicit key; " +
        "a fallback key here would be a publicly known test key."
    );
  }
  return key as Hex;
}
