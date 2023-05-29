// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract GLDKRC20 is ERC20 {
    constructor(
        address investingAddress,
        uint256 investingShares,
        address privateAddress,
        uint256 privateShares
    ) ERC20("Gold Karma", "GLDKRM") {
        _mint(investingAddress, investingShares);
        _mint(privateAddress, privateShares);
    }
}
