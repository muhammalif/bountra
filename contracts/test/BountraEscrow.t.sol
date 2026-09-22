// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BountraEscrow} from "../src/BountraEscrow.sol";

contract MockERC20 is ERC20 {
    bool private reentryEnabled;
    address private reentryTarget;
    bytes private reentryData;

    bool public reentryAttempted;
    bool public reentrySucceeded;
    bytes private reentryReturnData;

    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function configureReentry(address target, bytes calldata data) external {
        reentryEnabled = true;
        reentryTarget = target;
        reentryData = data;
    }

    function getReentryReturnData() external view returns (bytes memory) {
        return reentryReturnData;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (reentryEnabled && from == reentryTarget) {
            reentryEnabled = false;
            reentryAttempted = true;
            (bool succeeded, bytes memory returnData) = reentryTarget.call(reentryData);
            reentrySucceeded = succeeded;
            reentryReturnData = returnData;
        }

        super._update(from, to, value);
    }
}

contract BountraEscrowTest is Test {
    uint256 private constant AGENT_PRIVATE_KEY = 0xA11CE;
    uint256 private constant ATTACKER_PRIVATE_KEY = 0xBAD;
    uint256 private constant INITIAL_BALANCE = 1_000e18;
    uint256 private constant BOUNTY_AMOUNT = 100e18;
    uint256 private constant DEADLINE_DURATION = 7 days;

    address private constant CREATOR = address(0xA11CE);
    address private constant DEVELOPER = address(0xB0B);
    address private constant OTHER_ACCOUNT = address(0xC0FFEE);

    string private constant ISSUE_URL = "https://github.com/bountra/repo/issues/1";
    string private constant PR_URL = "https://github.com/bountra/repo/pull/7";
    string private constant COMMIT_HASH = "4c8a0c1";
    string private constant OTHER_COMMIT_HASH = "5d9b1d2";

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

    MockERC20 private token;
    BountraEscrow private escrow;
    address private agentSigner;

    function setUp() public {
        agentSigner = vm.addr(AGENT_PRIVATE_KEY);
        token = new MockERC20();
        escrow = new BountraEscrow(agentSigner);

        token.mint(CREATOR, INITIAL_BALANCE);
        vm.prank(CREATOR);
        token.approve(address(escrow), type(uint256).max);
    }

    function testConstructorRejectsZeroAgentSigner() public {
        vm.expectRevert(BountraEscrow.InvalidAgentSigner.selector);
        new BountraEscrow(address(0));
    }

    function testCreateBountyTransfersTokensAndStoresBounty() public {
        uint256 deadline = block.timestamp + DEADLINE_DURATION;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit BountyCreated(0, CREATOR, address(token), BOUNTY_AMOUNT, ISSUE_URL, deadline);

        vm.prank(CREATOR);
        uint256 bountyId = escrow.createBounty(ISSUE_URL, address(token), BOUNTY_AMOUNT, deadline);

        BountraEscrow.Bounty memory bounty = escrow.getBounty(bountyId);
        assertEq(bountyId, 0);
        assertEq(escrow.bountyCount(), 1);
        assertEq(bounty.creator, CREATOR);
        assertEq(bounty.token, address(token));
        assertEq(bounty.amount, BOUNTY_AMOUNT);
        assertEq(bounty.issueUrl, ISSUE_URL);
        assertEq(bounty.deadline, deadline);
        assertFalse(bounty.claimed);
        assertFalse(bounty.cancelled);
        assertEq(token.balanceOf(CREATOR), INITIAL_BALANCE - BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), BOUNTY_AMOUNT);
    }

    function testClaimBountyTransfersTokensToDeveloper() public {
        uint256 bountyId = _createBounty();
        bytes memory signature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, AGENT_PRIVATE_KEY);
        bytes32 messageHash = escrow.getMessageHash(bountyId, DEVELOPER, COMMIT_HASH, PR_URL);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit BountyClaimed(bountyId, DEVELOPER, PR_URL, COMMIT_HASH);

        vm.prank(DEVELOPER);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, signature);

        BountraEscrow.Bounty memory bounty = escrow.getBounty(bountyId);
        assertTrue(bounty.claimed);
        assertFalse(bounty.cancelled);
        assertTrue(escrow.usedSignatures(messageHash));
        assertEq(token.balanceOf(DEVELOPER), BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCancelBountyAfterDeadlineRefundsCreator() public {
        uint256 bountyId = _createBounty();
        BountraEscrow.Bounty memory bounty = escrow.getBounty(bountyId);

        vm.warp(bounty.deadline + 1);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit BountyCancelled(bountyId, CREATOR);

        vm.prank(CREATOR);
        escrow.cancelBounty(bountyId);

        bounty = escrow.getBounty(bountyId);
        assertFalse(bounty.claimed);
        assertTrue(bounty.cancelled);
        assertEq(token.balanceOf(CREATOR), INITIAL_BALANCE);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCreateBountyRejectsZeroAmount() public {
        vm.prank(CREATOR);
        vm.expectRevert(BountraEscrow.InvalidAmount.selector);
        escrow.createBounty(ISSUE_URL, address(token), 0, block.timestamp + DEADLINE_DURATION);
    }

    function testCreateBountyRejectsPastDeadline() public {
        vm.warp(1_000);

        vm.prank(CREATOR);
        vm.expectRevert(BountraEscrow.InvalidDeadline.selector);
        escrow.createBounty(ISSUE_URL, address(token), BOUNTY_AMOUNT, block.timestamp - 1);
    }

    function testCreateBountyRejectsInvalidToken() public {
        vm.prank(CREATOR);
        vm.expectRevert(BountraEscrow.InvalidToken.selector);
        escrow.createBounty(ISSUE_URL, address(0), BOUNTY_AMOUNT, block.timestamp + DEADLINE_DURATION);
    }

    function testClaimBountyRejectsUnauthorizedSigner() public {
        uint256 bountyId = _createBounty();
        bytes memory signature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, ATTACKER_PRIVATE_KEY);

        vm.prank(DEVELOPER);
        vm.expectRevert(BountraEscrow.UnauthorizedSigner.selector);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, signature);
    }

    function testClaimBountyRejectsInvalidDeveloper() public {
        uint256 bountyId = _createBounty();

        vm.expectRevert(BountraEscrow.InvalidDeveloper.selector);
        escrow.claimBounty(bountyId, address(0), PR_URL, COMMIT_HASH, bytes(""));
    }

    function testClaimBountyRejectsWrongCommitHash() public {
        uint256 bountyId = _createBounty();
        bytes memory signature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, AGENT_PRIVATE_KEY);

        vm.prank(DEVELOPER);
        vm.expectRevert(BountraEscrow.UnauthorizedSigner.selector);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, OTHER_COMMIT_HASH, signature);
    }

    function testClaimBountyRejectsReplayedSignature() public {
        uint256 bountyId = _createBounty();
        bytes memory signature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, AGENT_PRIVATE_KEY);

        vm.prank(DEVELOPER);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, signature);

        vm.prank(DEVELOPER);
        vm.expectRevert(BountraEscrow.SignatureAlreadyUsed.selector);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, signature);
    }

    function testClaimBountyRejectsDoubleClaim() public {
        uint256 bountyId = _createBounty();
        bytes memory firstSignature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, AGENT_PRIVATE_KEY);
        bytes memory secondSignature = _sign(bountyId, DEVELOPER, PR_URL, OTHER_COMMIT_HASH, AGENT_PRIVATE_KEY);

        vm.prank(DEVELOPER);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, firstSignature);

        vm.prank(DEVELOPER);
        vm.expectRevert(BountraEscrow.BountyAlreadyClaimed.selector);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, OTHER_COMMIT_HASH, secondSignature);
    }

    function testClaimBountyBlocksReentrancy() public {
        uint256 bountyId = _createBounty();
        bytes memory signature = _sign(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, AGENT_PRIVATE_KEY);
        bytes memory reentrySignature = _sign(bountyId, DEVELOPER, PR_URL, OTHER_COMMIT_HASH, AGENT_PRIVATE_KEY);
        bytes memory reentryData = abi.encodeCall(
            BountraEscrow.claimBounty, (bountyId, DEVELOPER, PR_URL, OTHER_COMMIT_HASH, reentrySignature)
        );

        token.configureReentry(address(escrow), reentryData);

        vm.prank(DEVELOPER);
        escrow.claimBounty(bountyId, DEVELOPER, PR_URL, COMMIT_HASH, signature);

        assertTrue(token.reentryAttempted());
        assertFalse(token.reentrySucceeded());
        assertEq(
            token.getReentryReturnData(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector)
        );
        assertEq(token.balanceOf(DEVELOPER), BOUNTY_AMOUNT);
    }

    function testCancelBountyRejectsEarlyCancellation() public {
        uint256 bountyId = _createBounty();

        vm.prank(CREATOR);
        vm.expectRevert(BountraEscrow.DeadlineNotPassed.selector);
        escrow.cancelBounty(bountyId);
    }

    function testCancelBountyRejectsNonCreator() public {
        uint256 bountyId = _createBounty();
        BountraEscrow.Bounty memory bounty = escrow.getBounty(bountyId);

        vm.warp(bounty.deadline + 1);
        vm.prank(OTHER_ACCOUNT);
        vm.expectRevert(BountraEscrow.UnauthorizedCreator.selector);
        escrow.cancelBounty(bountyId);
    }

    function _createBounty() private returns (uint256) {
        vm.prank(CREATOR);
        return escrow.createBounty(ISSUE_URL, address(token), BOUNTY_AMOUNT, block.timestamp + DEADLINE_DURATION);
    }

    function _sign(
        uint256 bountyId,
        address developer,
        string memory prUrl,
        string memory commitHash,
        uint256 privateKey
    ) private view returns (bytes memory) {
        bytes32 messageHash = escrow.getMessageHash(bountyId, developer, commitHash, prUrl);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, messageHash);
        return abi.encodePacked(r, s, v);
    }
}
