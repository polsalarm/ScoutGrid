// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ScoutGridMarket} from "../src/ScoutGridMarket.sol";

/// @dev Attacker used by the reentrancy tests. Its receive() tries to re-enter
///      placeBid using the AVAX it's currently being refunded with.
contract ReentrantBidder {
    ScoutGridMarket public market;
    address public targetPlayer;
    bool public reenter;

    constructor(ScoutGridMarket _market) {
        market = _market;
    }

    function arm(address _targetPlayer) external {
        targetPlayer = _targetPlayer;
        reenter = true;
    }

    function bid(address player, uint256 amount) external {
        market.placeBid{value: amount}(player);
    }

    receive() external payable {
        if (reenter) {
            // Reentrant call MUST fail — nonReentrant guard on placeBid.
            // try/catch swallows the revert so THIS receive() completes
            // normally, proving the direct refund still succeeds even
            // when the recipient attempts to re-enter the contract.
            try market.placeBid{value: msg.value}(targetPlayer) {
                reenteredSuccessfully = true; // must never happen
            } catch {}
        }
    }

    bool public reenteredSuccessfully;
}

/// @dev A recipient that always reverts on receive — used to prove the
///      pull-payment fallback (`pendingRefunds`) works when a direct refund fails.
contract RevertingReceiver {
    function bid(ScoutGridMarket market, address player, uint256 amount) external {
        market.placeBid{value: amount}(player);
    }

    receive() external payable {
        revert("nope");
    }
}

contract ScoutGridMarketTest is Test {
    ScoutGridMarket market;

    address admin = makeAddr("admin");
    address player = makeAddr("player");
    address guildA = makeAddr("guildA");
    address guildB = makeAddr("guildB");

    bytes32 constant ROLE_JUNGLER = bytes32("Jungler");
    bytes32 constant ROLE_ROAMER = bytes32("Roamer");
    bytes32 constant ROLE_MIDLANE = bytes32("Midlane");
    bytes32 constant ROLE_GOLDLANE = bytes32("Goldlane");
    bytes32 constant ROLE_SUPPORT = bytes32("Support");

    function setUp() public {
        market = new ScoutGridMarket(admin);
        vm.deal(guildA, 10_000 ether);
        vm.deal(guildB, 10_000 ether);
        vm.deal(admin, 10_000 ether);
    }

    /// @dev Registers `who` and mints a profile with empty bio/achievements.
    function _mint(address who, bytes32 role, uint256 listPrice) internal {
        vm.prank(who);
        market.registerUser("Player");
        vm.prank(who);
        string[] memory achievements = new string[](0);
        market.mintPlayerProfile(role, "", achievements, listPrice);
    }

    // ─── 1. Happy path: register + first sale ──────────────────────────────
    function test_HappyPath_RegisterAndFirstSale() public {
        _mint(player, ROLE_JUNGLER, 5_000);

        vm.prank(guildA);
        market.placeBid{value: 3_000}(player);
        assertEq(guildA.balance, 10_000 ether - 3_000);

        vm.prank(player);
        uint256 playerBalBefore = player.balance;
        market.acceptBid(player);

        assertEq(player.balance, playerBalBefore + 3_000);

        ScoutGridMarket.PlayerProfile memory p = market.getProfile(player);
        assertEq(p.owner, guildA);
        assertEq(p.listPrice, 3_000);
    }

    // ─── 2. Secondary sale with royalty ─────────────────────────────────────
    function test_SecondarySaleWithRoyalty() public {
        _mint(player, ROLE_ROAMER, 5_000);

        vm.prank(guildA);
        market.placeBid{value: 3_000}(player);
        vm.prank(player);
        market.acceptBid(player); // player gets 3000, guildA owns (listPrice now 3000)

        uint256 playerBalAfterFirst = player.balance;
        uint256 guildABalAfterFirst = guildA.balance; // 10_000e - 3_000

        vm.prank(guildB);
        market.placeBid{value: 2_000}(player);
        vm.prank(guildA);
        market.acceptBid(player); // guildA is current owner, accepts

        // royalty = 2000/10 = 200 to original player; sellerCut = 1800 to guildA
        assertEq(player.balance, playerBalAfterFirst + 200);
        assertEq(guildA.balance, guildABalAfterFirst + 1_800);

        ScoutGridMarket.PlayerProfile memory p = market.getProfile(player);
        assertEq(p.owner, guildB);
    }

    // ─── 3. Bid at/above list price rejected ───────────────────────────────
    function test_RevertWhen_BidAtOrAboveListPrice() public {
        _mint(player, ROLE_MIDLANE, 5_000);

        vm.prank(guildA);
        vm.expectRevert(ScoutGridMarket.BidTooLow.selector);
        market.placeBid{value: 5_000}(player);
    }

    // ─── 4. Refund on new (better) bid ──────────────────────────────────────
    function test_RefundOnNewBid() public {
        _mint(player, ROLE_GOLDLANE, 5_000);

        vm.prank(guildA);
        market.placeBid{value: 3_000}(player);
        assertEq(guildA.balance, 10_000 ether - 3_000);

        vm.prank(guildB);
        market.placeBid{value: 2_500}(player);

        assertEq(guildA.balance, 10_000 ether); // fully refunded
        assertEq(guildB.balance, 10_000 ether - 2_500);
        assertEq(market.getCurrentBid(player), 2_500);
    }

    // ─── 5. Mint without registering first is rejected ─────────────────────
    function test_RevertWhen_MintWithoutRegister() public {
        vm.prank(player);
        string[] memory achievements = new string[](0);
        vm.expectRevert(ScoutGridMarket.NotRegistered.selector);
        market.mintPlayerProfile(ROLE_SUPPORT, "", achievements, 1_000);
    }

    // ─── 6. Loan happy path ─────────────────────────────────────────────────
    function test_LoanHappyPath() public {
        vm.prank(admin);
        market.fundPool{value: 5_000}();
        assertEq(market.getPoolBalance(), 5_000);

        _mint(player, ROLE_JUNGLER, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player); // guildA owns player now

        uint256 guildABalBeforeLoan = guildA.balance;

        // WP=0 -> 50% LTV -> max_borrow = 3000 * 50 / 100 = 1500. Borrow 1000.
        vm.prank(guildA);
        market.takeLoan(player, 1_000);
        assertEq(guildA.balance, guildABalBeforeLoan + 1_000);
        assertEq(market.getPoolBalance(), 4_000);

        // Repay within 1 term: 1000 + (1000 * 500 / 10000) = 1050
        vm.prank(guildA);
        market.repayLoan{value: 1_050}(player);
        assertEq(guildA.balance, guildABalBeforeLoan + 1_000 - 1_050);
        assertEq(market.getPoolBalance(), 5_050); // pool gained 50 interest

        ScoutGridMarket.PlayerProfile memory p = market.getProfile(player);
        assertEq(p.listed, true);
        assertEq(p.owner, guildA);
    }

    // ─── 6b. Repay refunds excess msg.value ────────────────────────────────
    function test_RepayLoanRefundsExcessMsgValue() public {
        vm.prank(admin);
        market.fundPool{value: 5_000}();

        _mint(player, ROLE_JUNGLER, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);

        vm.prank(guildA);
        market.takeLoan(player, 1_000);

        uint256 balBefore = guildA.balance;
        // Overpay by 500 — repayment owed is 1050.
        vm.prank(guildA);
        market.repayLoan{value: 1_550}(player);

        assertEq(guildA.balance, balBefore - 1_050); // excess 500 refunded
    }

    // ─── 7. Loan compound interest ──────────────────────────────────────────
    function test_LoanCompoundInterest() public {
        vm.prank(admin);
        market.fundPool{value: 5_000}();

        _mint(player, ROLE_ROAMER, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);

        vm.prank(guildA);
        market.takeLoan(player, 1_000);

        uint256 balBeforeRepay = guildA.balance;

        // Advance time past 2 full terms -> ceil((2*30d + 1) / 30d) = 3 terms
        vm.warp(block.timestamp + market.LOAN_DURATION() * 2 + 1);

        // Compound: term1=1050, term2=1050+52=1102, term3=1102+55=1157
        vm.prank(guildA);
        market.repayLoan{value: 1_157}(player);
        assertEq(guildA.balance, balBeforeRepay - 1_157);
    }

    // ─── 8. Loan exceeds LTV rejected ───────────────────────────────────────
    function test_RevertWhen_LoanExceedsLTV() public {
        vm.prank(admin);
        market.fundPool{value: 10_000}();

        _mint(player, ROLE_MIDLANE, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);

        // WP=0 -> 50% LTV -> max=1500. Borrow 1501 -> revert ExceedsLTV.
        vm.prank(guildA);
        vm.expectRevert(ScoutGridMarket.ExceedsLTV.selector);
        market.takeLoan(player, 1_501);
    }

    // ─── 9. Liquidation — pool ABSORBS the loss (decision #3, locked) ──────
    function test_LoanLiquidation_PoolAbsorbsLoss() public {
        vm.prank(admin);
        market.fundPool{value: 5_000}();

        _mint(player, ROLE_GOLDLANE, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);

        vm.prank(guildA);
        market.takeLoan(player, 1_000);
        assertEq(market.getPoolBalance(), 4_000);

        vm.warp(block.timestamp + market.LOAN_DURATION() + 1);

        // guildB (or anyone) can liquidate.
        vm.prank(guildB);
        market.liquidate(player);

        // Pool does NOT recover the principal — it absorbs the loss.
        assertEq(market.getPoolBalance(), 4_000);

        // Solvency invariant: pool + escrow must never exceed real balance.
        assertLe(market.getPoolBalance(), address(market).balance);

        ScoutGridMarket.PlayerProfile memory p = market.getProfile(player);
        assertEq(p.owner, admin);
        assertEq(p.listed, true);
    }

    // ─── 10. Double loan on same collateral rejected ───────────────────────
    function test_RevertWhen_DoubleLoan() public {
        vm.prank(admin);
        market.fundPool{value: 10_000}();

        _mint(player, ROLE_SUPPORT, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);

        vm.prank(guildA);
        market.takeLoan(player, 500);

        vm.prank(guildA);
        vm.expectRevert(ScoutGridMarket.LoanAlreadyExists.selector);
        market.takeLoan(player, 500);
    }

    // ─── 11. Listed check: can't bid on loan-locked collateral (§2.8 fix) ──
    function test_RevertWhen_BidOnLoanLockedCollateral() public {
        vm.prank(admin);
        market.fundPool{value: 10_000}();

        _mint(player, ROLE_JUNGLER, 3_000);
        vm.prank(guildA);
        market.buyout{value: 3_000}(player);
        vm.prank(guildA);
        market.takeLoan(player, 500); // locks p.listed = false

        vm.prank(guildB);
        vm.expectRevert(ScoutGridMarket.NotListed.selector);
        market.placeBid{value: 100}(player);
    }

    // ─── 12. Buyout requires exact msg.value ───────────────────────────────
    function test_RevertWhen_BuyoutWrongMsgValue() public {
        _mint(player, ROLE_JUNGLER, 3_000);

        vm.prank(guildA);
        vm.expectRevert(ScoutGridMarket.WrongPaymentAmount.selector);
        market.buyout{value: 2_999}(player);
    }

    // ─── 13. Reentrancy: refund recipient's re-entry attempt must fail ─────
    function test_ReentrancyOnPlaceBidRefund_ReentrantCallIsBlocked() public {
        _mint(player, ROLE_JUNGLER, 10_000);

        ReentrantBidder attacker = new ReentrantBidder(market);
        vm.deal(address(attacker), 1_000);
        attacker.arm(player);

        vm.prank(address(attacker));
        attacker.bid(player, 1_000);
        assertEq(market.getCurrentBid(player), 1_000);
        assertEq(market.currentBidder(player), address(attacker));

        uint256 attackerBalBefore = address(attacker).balance;

        // guildB places a new (lower) bid, triggering a refund to the
        // attacker. The attacker's receive() tries to re-enter placeBid
        // with the refunded AVAX — nonReentrant must block it.
        vm.prank(guildB);
        market.placeBid{value: 500}(player);

        // The reentrant call reverted (caught internally), so the direct
        // refund itself still completes normally — no funds are stuck and
        // the reentrant bid never took effect.
        assertFalse(attacker.reenteredSuccessfully());
        assertEq(address(attacker).balance, attackerBalBefore + 1_000);
        assertEq(market.pendingRefunds(address(attacker)), 0);
        assertEq(market.currentBidder(player), guildB);
        assertEq(market.getCurrentBid(player), 500);
    }

    // ─── 14. Pull-payment fallback for a recipient that reverts on receive ─
    function test_PendingRefundFallback_RevertingReceiver() public {
        _mint(player, ROLE_JUNGLER, 10_000);

        RevertingReceiver stubborn = new RevertingReceiver();
        vm.deal(address(stubborn), 1_000);

        vm.prank(address(stubborn));
        stubborn.bid(market, player, 1_000);

        vm.prank(guildB);
        market.placeBid{value: 500}(player);

        assertEq(market.pendingRefunds(address(stubborn)), 1_000);
    }

    // ─── 15. Fuzz: solvency invariant holds across arbitrary bid sequences ─
    function testFuzz_SolvencyInvariant_AcrossBidSequence(uint96 bidA, uint96 bidB) public {
        _mint(player, ROLE_JUNGLER, 100_000 ether);

        bidA = uint96(bound(bidA, 1, 50_000 ether));
        bidB = uint96(bound(bidB, 1, 50_000 ether));
        vm.deal(guildA, uint256(bidA) + 1 ether);
        vm.deal(guildB, uint256(bidB) + 1 ether);

        vm.prank(guildA);
        market.placeBid{value: bidA}(player);

        vm.prank(guildB);
        market.placeBid{value: bidB}(player);

        assertLe(market.getPoolBalance(), address(market).balance);
        assertLe(market.getCurrentBid(player), address(market).balance);
    }
}
