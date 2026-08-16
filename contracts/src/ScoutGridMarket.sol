// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ScoutGridMarket
/// @notice Avalanche port of the ScoutGrid Soroban contract. Native-AVAX marketplace +
///         collateralized lending for on-chain esports player profiles.
contract ScoutGridMarket is ReentrancyGuard {
    // ─── Errors ─────────────────────────────────────────────────────────────
    error AlreadyInitialized();
    error Unauthorized();
    error BidTooLow();
    error NotRegistered();
    error NoActiveBid();
    error InvalidAmount();
    error UserAlreadyRegistered();
    error ProfileAlreadyExists();
    error ProfileNotFound();
    error LoanAlreadyExists();
    error NoActiveLoan();
    error InsufficientPool();
    error LoanNotExpired();
    error CollateralNotOwned();
    error ExceedsLTV();
    error NotListed();
    error BioTooLong();
    error TooManyAchievements();
    error WrongPaymentAmount();
    error TransferFailed();

    // ─── Types ──────────────────────────────────────────────────────────────
    struct PlayerProfile {
        string username;
        bytes32 role;
        string bio;
        string[] achievements;
        uint32 winPoints;
        address owner;
        address originalCreator;
        uint256 listPrice;
        bool listed;
    }

    struct LoanRecord {
        address borrower;
        uint256 principal;
        uint64 startTime;
        uint64 dueTime;
    }

    struct MarketItem {
        address player;
        PlayerProfile profile;
        uint256 currentBid;
        address currentBidder;
    }

    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 public constant LOAN_DURATION = 30 days; // mirrors 518_400 ledgers @ 5s/ledger
    uint256 public constant INTEREST_RATE_BPS = 500; // 5% per term
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant MAX_BIO_LEN = 500;
    uint256 public constant MAX_ACHIEVEMENTS = 10;
    uint256 public constant MAX_PAGE_SIZE = 200;

    // ─── Storage ────────────────────────────────────────────────────────────
    address public admin;

    mapping(address => string) private _usernames;
    mapping(address => bool) private _registered;

    mapping(address => PlayerProfile) private _profiles;
    mapping(address => bool) private _hasProfile;

    mapping(address => uint256) public currentBid;
    mapping(address => address) public currentBidder;

    address[] private _playerRegistry;

    mapping(address => LoanRecord) private _loans;
    mapping(address => bool) private _hasLoan;
    uint256 public loanPool;

    /// @dev Pull-payment escape hatch: credited when a refund `.call` fails
    ///      (e.g. the recipient is a contract that reverts on receive).
    mapping(address => uint256) public pendingRefunds;

    // ─── Events ─────────────────────────────────────────────────────────────
    event AdminChanged(address indexed newAdmin);
    event UserRegistered(address indexed user, string username);
    event ProfileMinted(address indexed player, uint256 listPrice);
    event WinPointAdded(address indexed player, uint32 newWinPoints);
    event BidPlaced(address indexed player, address indexed bidder, uint256 amount);
    event BidAccepted(address indexed player, address indexed newOwner, uint256 amount);
    event BoughtOut(address indexed player, address indexed buyer, uint256 amount);
    event PoolFunded(address indexed funder, uint256 amount);
    event LoanTaken(address indexed player, address indexed borrower, uint256 principal, uint64 dueTime);
    event LoanRepaid(address indexed player, address indexed borrower, uint256 repayment);
    event Liquidated(address indexed player, address indexed previousBorrower, uint256 principal);
    event RefundWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ────────────────────────────────────────────────────────
    constructor(address admin_) {
        admin = admin_;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    // ─── LTV curve (mirrors compute_max_ltv in the Soroban contract) ─────────
    function _computeMaxLtv(uint32 winPoints) internal pure returns (uint256) {
        if (winPoints == 0) return 50;
        if (winPoints <= 2) return 55;
        if (winPoints <= 5) return 65;
        if (winPoints <= 9) return 72;
        return 80;
    }

    // ─── Registration & minting ───────────────────────────────────────────────

    function registerUser(string calldata username) external {
        if (_registered[msg.sender]) revert UserAlreadyRegistered();
        _registered[msg.sender] = true;
        _usernames[msg.sender] = username;
        emit UserRegistered(msg.sender, username);
    }

    function mintPlayerProfile(bytes32 role, string calldata bio, string[] calldata achievements, uint256 listPrice)
        external
    {
        if (!_registered[msg.sender]) revert NotRegistered();
        if (listPrice == 0) revert InvalidAmount();
        if (_hasProfile[msg.sender]) revert ProfileAlreadyExists();
        if (bytes(bio).length > MAX_BIO_LEN) revert BioTooLong();
        if (achievements.length > MAX_ACHIEVEMENTS) revert TooManyAchievements();

        PlayerProfile storage p = _profiles[msg.sender];
        p.username = _usernames[msg.sender];
        p.role = role;
        p.bio = bio;
        for (uint256 i = 0; i < achievements.length; i++) {
            p.achievements.push(achievements[i]);
        }
        p.winPoints = 0;
        p.owner = msg.sender;
        p.originalCreator = msg.sender;
        p.listPrice = listPrice;
        p.listed = true;

        _hasProfile[msg.sender] = true;
        _playerRegistry.push(msg.sender);

        emit ProfileMinted(msg.sender, listPrice);
    }

    function addWinPoint(address player) external onlyAdmin {
        if (!_hasProfile[player]) revert ProfileNotFound();
        _profiles[player].winPoints += 1;
        emit WinPointAdded(player, _profiles[player].winPoints);
    }

    // ─── Marketplace ────────────────────────────────────────────────────────

    /// @notice Bargain bid — must be strictly lower than list_price. Refunds the
    ///         previous bidder (pull-payment fallback if the refund call fails).
    function placeBid(address player) external payable nonReentrant {
        uint256 amount = msg.value;
        if (amount == 0) revert InvalidAmount();

        PlayerProfile storage p = _profiles[player];
        if (!_hasProfile[player]) revert NotRegistered();
        if (!p.listed) revert NotListed();
        if (amount >= p.listPrice) revert BidTooLow();

        uint256 prevBid = currentBid[player];
        address prevBidder = currentBidder[player];

        // Effects before interactions.
        currentBidder[player] = msg.sender;
        currentBid[player] = amount;

        if (prevBid > 0) {
            _refund(prevBidder, prevBid);
        }

        emit BidPlaced(player, msg.sender, amount);
    }

    /// @notice Current owner accepts the standing bid; royalty auto-applied.
    function acceptBid(address player) external nonReentrant {
        PlayerProfile storage p = _profiles[player];
        if (!_hasProfile[player]) revert NotRegistered();
        if (msg.sender != p.owner) revert Unauthorized();

        uint256 bid = currentBid[player];
        if (bid == 0) revert NoActiveBid();
        address bidder = currentBidder[player];

        address prevOwner = p.owner;
        address creator = p.originalCreator;

        p.owner = bidder;
        p.listPrice = bid;
        // `listed` stays true — the new owner's contract remains tradeable
        // immediately (only takeLoan/repayLoan/liquidate toggle this flag).
        currentBid[player] = 0;
        currentBidder[player] = address(0);

        if (prevOwner == creator) {
            _refund(prevOwner, bid);
        } else {
            uint256 royalty = bid / 10;
            uint256 sellerCut = bid - royalty;
            _refund(creator, royalty);
            _refund(prevOwner, sellerCut);
        }

        emit BidAccepted(player, bidder, bid);
    }

    /// @notice Instant buyout at list_price. Refunds any standing bargain bid.
    function buyout(address player) external payable nonReentrant {
        PlayerProfile storage p = _profiles[player];
        if (!_hasProfile[player]) revert NotRegistered();
        if (!p.listed) revert NotListed();

        uint256 price = p.listPrice;
        if (price == 0) revert InvalidAmount();
        if (msg.value != price) revert WrongPaymentAmount();

        address prevOwner = p.owner;
        address creator = p.originalCreator;

        uint256 prevBid = currentBid[player];
        address prevBidder = currentBidder[player];

        p.owner = msg.sender;
        // `listed` stays true — see acceptBid for rationale.
        currentBid[player] = 0;
        currentBidder[player] = address(0);

        if (prevOwner == creator) {
            _refund(prevOwner, price);
        } else {
            uint256 royalty = price / 10;
            uint256 sellerCut = price - royalty;
            _refund(creator, royalty);
            _refund(prevOwner, sellerCut);
        }

        if (prevBid > 0) {
            _refund(prevBidder, prevBid);
        }

        emit BoughtOut(player, msg.sender, price);
    }

    // ─── Loans ──────────────────────────────────────────────────────────────

    function fundPool() external payable {
        if (msg.value == 0) revert InvalidAmount();
        loanPool += msg.value;
        emit PoolFunded(msg.sender, msg.value);
    }

    /// @notice Lock a player profile as collateral and borrow AVAX from the pool.
    function takeLoan(address player, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        PlayerProfile storage p = _profiles[player];
        if (!_hasProfile[player]) revert NotRegistered();
        if (p.owner != msg.sender) revert CollateralNotOwned();
        if (_hasLoan[player]) revert LoanAlreadyExists();

        uint256 ltv = _computeMaxLtv(p.winPoints);
        uint256 maxBorrow = (p.listPrice * ltv) / 100;
        if (amount > maxBorrow) revert ExceedsLTV();
        if (amount > loanPool) revert InsufficientPool();

        uint64 dueTime = uint64(block.timestamp + LOAN_DURATION);
        _loans[player] =
            LoanRecord({borrower: msg.sender, principal: amount, startTime: uint64(block.timestamp), dueTime: dueTime});
        _hasLoan[player] = true;
        loanPool -= amount;

        // Lock the collateral — cannot be sold while pledged.
        p.listed = false;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit LoanTaken(player, msg.sender, amount, dueTime);
    }

    /// @notice Repay principal + compound interest to unlock the collateral.
    ///         Excess `msg.value` beyond the computed repayment is refunded.
    function repayLoan(address player) external payable nonReentrant {
        if (!_hasLoan[player]) revert NoActiveLoan();
        LoanRecord memory loan = _loans[player];
        if (loan.borrower != msg.sender) revert Unauthorized();

        uint256 repayment = _computeRepayment(loan);
        if (msg.value < repayment) revert InvalidAmount();

        delete _loans[player];
        _hasLoan[player] = false;
        loanPool += repayment;

        PlayerProfile storage p = _profiles[player];
        p.listed = true;

        uint256 excess = msg.value - repayment;
        if (excess > 0) {
            _refund(msg.sender, excess);
        }

        emit LoanRepaid(player, msg.sender, repayment);
    }

    function _computeRepayment(LoanRecord memory loan) internal view returns (uint256) {
        uint256 elapsed = block.timestamp > loan.startTime ? block.timestamp - loan.startTime : 0;
        uint256 terms = (elapsed + LOAN_DURATION - 1) / LOAN_DURATION;
        if (terms == 0) terms = 1;

        uint256 repayment = loan.principal;
        for (uint256 i = 0; i < terms; i++) {
            repayment += (repayment * INTEREST_RATE_BPS) / BPS_DENOM;
        }
        return repayment;
    }

    /// @notice Anyone may liquidate an expired loan. Ownership transfers to
    ///         admin; the pool does NOT recover the principal (decision #3,
    ///         locked 2026-08-16) — the seized collateral is the compensation.
    function liquidate(address player) external nonReentrant {
        if (!_hasLoan[player]) revert NoActiveLoan();
        LoanRecord memory loan = _loans[player];
        if (block.timestamp <= loan.dueTime) revert LoanNotExpired();

        delete _loans[player];
        _hasLoan[player] = false;

        PlayerProfile storage p = _profiles[player];
        p.owner = admin;
        p.listed = true;

        emit Liquidated(player, loan.borrower, loan.principal);
    }

    // ─── Refund pull-payment ────────────────────────────────────────────────

    function _refund(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) {
            pendingRefunds[to] += amount;
        }
    }

    function withdrawRefund() external nonReentrant {
        uint256 amount = pendingRefunds[msg.sender];
        if (amount == 0) revert InvalidAmount();
        pendingRefunds[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RefundWithdrawn(msg.sender, amount);
    }

    // ─── Read-only views ────────────────────────────────────────────────────

    function getUsername(address user) external view returns (string memory) {
        if (!_registered[user]) revert NotRegistered();
        return _usernames[user];
    }

    function getProfile(address player) external view returns (PlayerProfile memory) {
        if (!_hasProfile[player]) revert NotRegistered();
        return _profiles[player];
    }

    function getCurrentBid(address player) external view returns (uint256) {
        return currentBid[player];
    }

    function getAllPlayerAddresses() external view returns (address[] memory) {
        return _playerRegistry;
    }

    function getLoan(address player) external view returns (bool exists, LoanRecord memory loan) {
        exists = _hasLoan[player];
        loan = _loans[player];
    }

    function getPoolBalance() external view returns (uint256) {
        return loanPool;
    }

    function registryLength() external view returns (uint256) {
        return _playerRegistry.length;
    }

    /// @notice High-performance sync: all LISTED market items in one call.
    ///         Unbounded — fine for `eth_call`, but see getMarketItemsPaged for
    ///         large registries (defensive against RPC gas caps on `eth_call`).
    function getAllMarketItems() external view returns (MarketItem[] memory) {
        uint256 len = _playerRegistry.length;
        MarketItem[] memory buffer = new MarketItem[](len);
        uint256 count = 0;
        for (uint256 i = 0; i < len; i++) {
            address player = _playerRegistry[i];
            PlayerProfile storage p = _profiles[player];
            if (p.listed) {
                buffer[count] = MarketItem({
                    player: player, profile: p, currentBid: currentBid[player], currentBidder: currentBidder[player]
                });
                count++;
            }
        }
        MarketItem[] memory items = new MarketItem[](count);
        for (uint256 i = 0; i < count; i++) {
            items[i] = buffer[i];
        }
        return items;
    }

    /// @notice Paginated variant of getAllMarketItems for large registries.
    function getMarketItemsPaged(uint256 offset, uint256 limit)
        external
        view
        returns (MarketItem[] memory items, uint256 nextOffset)
    {
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        uint256 len = _playerRegistry.length;
        uint256 end = offset + limit;
        if (end > len) end = len;

        MarketItem[] memory buffer = new MarketItem[](end > offset ? end - offset : 0);
        uint256 count = 0;
        for (uint256 i = offset; i < end; i++) {
            address player = _playerRegistry[i];
            PlayerProfile storage p = _profiles[player];
            if (p.listed) {
                buffer[count] = MarketItem({
                    player: player, profile: p, currentBid: currentBid[player], currentBidder: currentBidder[player]
                });
                count++;
            }
        }
        items = new MarketItem[](count);
        for (uint256 i = 0; i < count; i++) {
            items[i] = buffer[i];
        }
        nextOffset = end;
    }

    function getOwnedAssets(address owner) external view returns (MarketItem[] memory) {
        uint256 len = _playerRegistry.length;
        MarketItem[] memory buffer = new MarketItem[](len);
        uint256 count = 0;
        for (uint256 i = 0; i < len; i++) {
            address player = _playerRegistry[i];
            PlayerProfile storage p = _profiles[player];
            if (p.owner == owner) {
                buffer[count] = MarketItem({
                    player: player, profile: p, currentBid: currentBid[player], currentBidder: currentBidder[player]
                });
                count++;
            }
        }
        MarketItem[] memory items = new MarketItem[](count);
        for (uint256 i = 0; i < count; i++) {
            items[i] = buffer[i];
        }
        return items;
    }

    /// @dev Accept plain AVAX transfers (e.g. accidental sends) without reverting.
    receive() external payable {}
}
