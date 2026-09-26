// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDT is ERC20, Ownable {
    uint8 private constant _DECIMALS = 18;

    constructor() ERC20("Tether USD", "USDT") Ownable(msg.sender) {
        // Mint initial 1,000,000 USDT to deployer for immediate demo usage
        _mint(msg.sender, 1_000_000 * 10 ** _DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Anyone can mint test USDT for demo and hackathon testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
