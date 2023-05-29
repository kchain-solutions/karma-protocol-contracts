// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./GLDKRC20.sol";

contract InvestorVault is ReentrancyGuard {
    uint256 public constant EPOCH_2_WAIT = 4;

    event Lock(address indexed user, uint256 amount);
    event Unlock(address indexed user, uint256 amount);
    event Bought(
        address indexed user,
        uint256 ierc20Amount,
        uint256 gldkrmAmount
    );
    event EtherReceived(address indexed donator, uint256 amount);

    GLDKRC20 public gldkrc20;
    IERC20 public ierc20;

    mapping(address => uint256) public lastClaimed;
    mapping(uint256 => uint256) public epochBalances;
    mapping(address => uint256) public whenLockedFunds;
    mapping(address => uint256) public lockedBalances;

    uint256 public epochDuration = 7 days;
    uint256 public rate = 2; // Conversion rate for buying GLDKRC20 with ierc20
    uint256 public currentEpoch = 0;
    uint256 public deploymentTime;

    address public purchaseReceiver;

    constructor(
        GLDKRC20 _gldkrc20,
        IERC20 _ierc20,
        uint256 _rate,
        address _purchaseReceiver
    ) {
        require(_rate > 0, "Rate must be greater than 0");
        gldkrc20 = _gldkrc20;
        ierc20 = _ierc20;
        purchaseReceiver = _purchaseReceiver;
        deploymentTime = block.timestamp;
        rate = _rate;
    }

    function claim() public nonReentrant {
        require(
            lastClaimed[msg.sender] < currentEpoch,
            "No unclaimed timeslots"
        );
        require(
            currentEpoch >= whenLockedFunds[msg.sender] + EPOCH_2_WAIT,
            "Still not authorized"
        );
        uint256 balance = lockedBalances[msg.sender];
        require(balance > 0, "No tokens to claim with");
        uint256 totalSupply = gldkrc20.totalSupply();
        require(totalSupply > 0, "Total supply is 0");
        for (uint256 i = lastClaimed[msg.sender] + 1; i < currentEpoch; i++) {
            uint256 contractBalance = epochBalances[i];
            if (contractBalance > 0) {
                uint256 amount = (contractBalance * balance) / totalSupply;

                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "Transfer failed.");
            }
        }
        lastClaimed[msg.sender] = currentEpoch - 1;
    }

    function whenCanClaim(address user) public view returns (uint256) {
        if (currentEpoch <= whenLockedFunds[user] + EPOCH_2_WAIT) {
            return whenLockedFunds[user] + EPOCH_2_WAIT - currentEpoch;
        } else {
            return 0;
        }
    }

    function lock(uint256 amount) public nonReentrant {
        require(gldkrc20.balanceOf(msg.sender) >= amount, "Not valid amount");
        gldkrc20.transferFrom(msg.sender, address(this), amount);
        if (lockedBalances[msg.sender] == 0) {
            whenLockedFunds[msg.sender] = currentEpoch;
        }
        lockedBalances[msg.sender] = lockedBalances[msg.sender] + amount;
        emit Lock(msg.sender, amount);
    }

    function unlock(uint256 amount) public nonReentrant {
        require(amount <= lockedBalances[msg.sender], "Not valid amount");
        lockedBalances[msg.sender] = lockedBalances[msg.sender] - amount;
        gldkrc20.transfer(msg.sender, amount);
        if (lockedBalances[msg.sender] == 0) {
            whenLockedFunds[msg.sender] = 0;
        }
        emit Unlock(msg.sender, amount);
    }

    function buy(uint256 tokenAmount) public nonReentrant {
        uint256 balance = ierc20.balanceOf(msg.sender);
        require(balance >= tokenAmount, "Not enough ERC20 tokens to buy");
        uint256 GLDKRC20Amount = tokenAmount * rate; // Calculate the GLDKRC20 amount based on the rate
        uint256 GLDKRC20Balance = gldkrc20.balanceOf(address(this));
        require(
            GLDKRC20Balance >= GLDKRC20Amount,
            "Not enough GLDKRC20 tokens in contract"
        );
        ierc20.transferFrom(msg.sender, purchaseReceiver, tokenAmount);
        gldkrc20.transfer(msg.sender, GLDKRC20Amount);
        emit Bought(msg.sender, tokenAmount, GLDKRC20Amount);
    }

    function receiveEther() public payable {
        uint256 elapsedSlots = (block.timestamp - deploymentTime) /
            epochDuration +
            1;
        if (elapsedSlots > currentEpoch) {
            currentEpoch = elapsedSlots;
        }
        epochBalances[currentEpoch] += msg.value;
        emit EtherReceived(msg.sender, msg.value);
    }
}
