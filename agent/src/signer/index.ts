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
