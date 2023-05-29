// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(address owner, uint256 supply) ERC20("Test USDT", "USDT") {
        _mint(owner, supply);
    }

    function mint(address to) public {
        _mint(to, 10 * (10 ** 18));
    }
}
