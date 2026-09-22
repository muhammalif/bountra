// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract BountraEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidAgentSigner();
    error InvalidToken();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidDeveloper();
    error BountyNotFound();
    error UnauthorizedSigner();
    error SignatureAlreadyUsed();
    error BountyAlreadyClaimed();
    error BountyAlreadyCancelled();
    error UnauthorizedCreator();
    error DeadlineNotPassed();

    struct Bounty {
        address creator;
        address token;
        uint256 amount;
        string issueUrl;
        uint256 deadline;
        bool claimed;
        bool cancelled;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(bytes32 => bool) public usedSignatures;

    uint256 public bountyCount;
    address public immutable agentSigner;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        address token,
        uint256 amount,
        string issueUrl,
        uint256 deadline
    );
    event BountyClaimed(uint256 indexed bountyId, address indexed developer, string prUrl, string commitHash);
    event BountyCancelled(uint256 indexed bountyId, address indexed creator);

    constructor(address agentSigner_) {
        if (agentSigner_ == address(0)) revert InvalidAgentSigner();

        agentSigner = agentSigner_;
    }

    function createBounty(string calldata issueUrl, address token, uint256 amount, uint256 deadline)
        external
        nonReentrant
        returns (uint256 bountyId)
    {
        if (token == address(0) || token.code.length == 0) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        bountyId = bountyCount++;
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            token: token,
            amount: amount,
            issueUrl: issueUrl,
            deadline: deadline,
            claimed: false,
            cancelled: false
        });

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit BountyCreated(bountyId, msg.sender, token, amount, issueUrl, deadline);
    }

    function claimBounty(
        uint256 bountyId,
        address devWallet,
        string calldata prUrl,
        string calldata commitHash,
        bytes calldata signature
    ) external nonReentrant {
        Bounty storage bounty = _getBounty(bountyId);

        if (devWallet == address(0)) revert InvalidDeveloper();

        bytes32 messageHash = _getMessageHash(bountyId, devWallet, commitHash, prUrl);
        if (usedSignatures[messageHash]) revert SignatureAlreadyUsed();
        if (ECDSA.recover(messageHash, signature) != agentSigner) revert UnauthorizedSigner();
        if (bounty.claimed) revert BountyAlreadyClaimed();
        if (bounty.cancelled) revert BountyAlreadyCancelled();

        usedSignatures[messageHash] = true;
        bounty.claimed = true;

        IERC20(bounty.token).safeTransfer(devWallet, bounty.amount);

        emit BountyClaimed(bountyId, devWallet, prUrl, commitHash);
    }

    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _getBounty(bountyId);

        if (msg.sender != bounty.creator) revert UnauthorizedCreator();
        if (bounty.claimed) revert BountyAlreadyClaimed();
        if (bounty.cancelled) revert BountyAlreadyCancelled();
        if (block.timestamp <= bounty.deadline) revert DeadlineNotPassed();

        bounty.cancelled = true;

        IERC20(bounty.token).safeTransfer(bounty.creator, bounty.amount);

        emit BountyCancelled(bountyId, bounty.creator);
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _getBounty(bountyId);
    }

    function getMessageHash(uint256 bountyId, address devWallet, string calldata commitHash, string calldata prUrl)
        external
        view
        returns (bytes32)
    {
        return _getMessageHash(bountyId, devWallet, commitHash, prUrl);
    }

    function _getBounty(uint256 bountyId) private view returns (Bounty storage bounty) {
        if (bountyId >= bountyCount) revert BountyNotFound();

        return bounties[bountyId];
    }

    function _getMessageHash(uint256 bountyId, address devWallet, string memory commitHash, string memory prUrl)
        private
        view
        returns (bytes32)
    {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(bountyId, devWallet, commitHash, prUrl, address(this), block.chainid))
        );
    }
}
