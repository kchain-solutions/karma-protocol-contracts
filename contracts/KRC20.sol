// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract KRC20 is ERC20, Ownable {
    using SafeMath for uint256;

    uint256 private constant INVESTOR_PERCENTAGE = 40;

    event NewProposal(
        uint256 indexed proposalId,
        string proposalType,
        string proposalName,
        string proposalDescription,
        uint256 proposalDeadlineDate
    );
    event ApprovedProposal(uint256 indexed proposalId);
    event Vote(uint256 indexed proposalId, address indexed voter, bool approve);

    uint256 public quorum;
    uint256 public proposalCount;
    uint256 public membersCount;
    uint256 public mintingThreshold;
    uint256 public burningRate;
    uint256 public lastRewardClaim;
    uint256 private totalVotes;
    uint256 private constant WAIT_TIME_REWARD = 604800;
    address[] private eligibleToRewardMembers;
    address public investorVaultAddress;
    mapping(address => uint256) private voteMemberCounter;
    mapping(address => bool) private authorizedContracts;
    mapping(address => bool) private members;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) private proposalVotes;

    struct Proposal {
        ProposalType proposalType;
        string proposalName;
        address targetAddress;
        uint256 targetValue;
        string proposalURI;
        bool approved;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadlineDate;
        uint256 creationDate;
    }

    enum ProposalType {
        AddMember,
        RemoveMember,
        AddContract,
        RemoveContract,
        Threshhold,
        BurningRate
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 _quorum,
        address _investorVaultAddress
    ) ERC20(name, symbol) {
        members[msg.sender] = true;
        quorum = _quorum;
        membersCount = 1;
        mintingThreshold = 0;
        burningRate = 80;
        lastRewardClaim = block.timestamp;
        investorVaultAddress = _investorVaultAddress;
    }

    function addMemberProposal(
        address newMember,
        string memory _proposalName,
        string memory _proposalURI,
        uint256 _deadlineDate
    ) public onlyMember afterDeadline(_deadlineDate) {
        require(!members[newMember], "Member already exists");
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalName: _proposalName,
            proposalType: ProposalType.AddMember,
            proposalURI: _proposalURI,
            targetAddress: newMember,
            targetValue: 0,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "AddMember",
            _proposalName,
            _proposalURI,
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function removeMemberProposal(
        address existingMember,
        string memory _proposalName,
        string memory _proposalURI,
        uint256 _deadlineDate
    ) public onlyMember afterDeadline(_deadlineDate) {
        require(members[existingMember], "Member does not exist");
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalName: _proposalName,
            proposalType: ProposalType.RemoveMember,
            proposalURI: _proposalURI,
            targetAddress: existingMember,
            targetValue: 0,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "RemoveMember",
            _proposalName,
            _proposalURI,
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function addContractProposal(
        address contractAddress,
        string memory _proposalName,
        string memory _proposalURI,
        uint256 _deadlineDate
    ) public afterDeadline(_deadlineDate) {
        require(
            !authorizedContracts[contractAddress],
            "Contract already exists"
        );
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalType: ProposalType.AddContract,
            proposalName: _proposalName,
            proposalURI: _proposalURI,
            targetAddress: contractAddress,
            targetValue: 0,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "AddContract",
            _proposalName,
            _proposalURI,
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function removeContractProposal(
        address contractAddress,
        string memory _proposalName,
        string memory _proposalURI,
        uint256 _deadlineDate
    ) public onlyMember afterDeadline(_deadlineDate) {
        require(authorizedContracts[contractAddress], "Contract doesn't exist");
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalType: ProposalType.RemoveContract,
            proposalName: _proposalName,
            proposalURI: _proposalURI,
            targetAddress: contractAddress,
            targetValue: 0,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "RemoveContract",
            _proposalName,
            _proposalURI,
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function changeThresholdProposal(
        uint256 threshold,
        string memory _proposalName,
        uint256 _deadlineDate
    ) public onlyMember afterDeadline(_deadlineDate) {
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalType: ProposalType.Threshhold,
            proposalName: _proposalName,
            proposalURI: "NA",
            targetAddress: address(0x0),
            targetValue: threshold,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "Threshhold",
            _proposalName,
            "NA",
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function changeBurningRateProposal(
        uint256 _burningRate,
        string memory _proposalName,
        uint256 _deadlineDate
    ) public onlyMember afterDeadline(_deadlineDate) {
        uint256 _proposalId = proposalCount;
        proposals[_proposalId] = Proposal({
            proposalType: ProposalType.BurningRate,
            proposalName: _proposalName,
            proposalURI: "NA",
            targetAddress: address(0x0),
            targetValue: _burningRate,
            approved: false,
            yesVotes: 0,
            noVotes: 0,
            deadlineDate: _deadlineDate,
            creationDate: block.timestamp
        });
        emit NewProposal(
            proposalCount,
            "BurningRate",
            _proposalName,
            "NA",
            _deadlineDate
        );
        proposalCount = proposalCount.add(1);
    }

    function voteProposal(uint256 proposalId, bool approve) public onlyMember {
        Proposal storage proposal = proposals[proposalId];
        require(!proposalVotes[proposalId][msg.sender], "Already voted");
        require(proposal.deadlineDate > block.timestamp, "Deadline passed");
        proposalVotes[proposalId][msg.sender] = true;
        if (approve) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }
        managegeEligibleRewardMembers(msg.sender);
        emit Vote(proposalId, msg.sender, approve);
    }

    function managegeEligibleRewardMembers(address member) private {
        bool found = false;
        totalVotes = totalVotes.add(1);
        if (eligibleToRewardMembers.length == 0) {
            eligibleToRewardMembers.push(member);
            voteMemberCounter[member] = voteMemberCounter[member] + 1;
        } else {
            for (uint256 i = 0; i < eligibleToRewardMembers.length; i++) {
                if (eligibleToRewardMembers[i] == member) {
                    voteMemberCounter[member] = voteMemberCounter[member] + 1;
                    found = true;
                }
            }
            if (!found) {
                eligibleToRewardMembers.push(member);
                voteMemberCounter[member] = voteMemberCounter[member] + 1;
            }
        }
    }

    function claimProposal(uint256 proposalId) public {
        Proposal storage proposal = proposals[proposalId];
        require(
            block.timestamp > proposal.deadlineDate ||
                proposal.yesVotes.mul(100).div(membersCount) > 50,
            "Proposal can't be claimed"
        );
        require(
            isQuorum(proposal.yesVotes, proposal.noVotes),
            "Quorum not reached"
        );
        if (proposal.proposalType == ProposalType.AddMember) {
            require(!members[proposal.targetAddress], "Member already claimed");
            proposal.approved = true;
            membersCount.add(1);
            members[proposal.targetAddress] = true;
            emit ApprovedProposal(proposalId);
        } else if (proposal.proposalType == ProposalType.RemoveMember) {
            require(members[proposal.targetAddress], "Member already removed");
            proposal.approved = true;
            membersCount.sub(1);
            members[proposal.targetAddress] = false;
            emit ApprovedProposal(proposalId);
        } else if (proposal.proposalType == ProposalType.AddContract) {
            require(
                !authorizedContracts[proposal.targetAddress],
                "Contract already claimed"
            );
            proposal.approved = true;
            authorizedContracts[proposal.targetAddress] = true;
            emit ApprovedProposal(proposalId);
        } else if (proposal.proposalType == ProposalType.RemoveContract) {
            require(
                authorizedContracts[proposal.targetAddress],
                "Contract already removed"
            );
            proposal.approved = true;
            authorizedContracts[proposal.targetAddress] = false;
            emit ApprovedProposal(proposalId);
        } else if (proposal.proposalType == ProposalType.Threshhold) {
            mintingThreshold = proposal.targetValue;
            emit ApprovedProposal(proposalId);
        } else if (proposal.proposalType == ProposalType.BurningRate) {
            burningRate = proposal.targetValue;
            emit ApprovedProposal(proposalId);
        }
    }

    function isQuorum(
        uint256 yesVotes,
        uint256 noVotes
    ) private view returns (bool) {
        return
            yesVotes > noVotes &&
            yesVotes.add(noVotes).mul(100).div(membersCount) > quorum;
    }

    function mint(
        address buyer,
        address seller
    ) public payable onlyAuthorizedContract {
        if (msg.value > mintingThreshold) {
            _mint(buyer, 10 ** 18);
            _mint(seller, 10 ** 18);
        }
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        require(balanceOf(msg.sender) >= amount, "insufficient balance");
        uint256 toBurn = amount.mul(burningRate).div(100);
        uint toTransfer = amount - toBurn;
        _burn(msg.sender, toBurn);
        return super.transfer(recipient, toTransfer);
    }

    function isMember(address memberAddress) public view returns (bool) {
        return members[memberAddress];
    }

    function isAuthorizedContract(
        address contractAddr
    ) public view returns (bool) {
        return authorizedContracts[contractAddr];
    }

    function donation() public payable {}

    function claimRewards() public onlyOwner onlyAfterSevenDays {
        require(totalVotes > 0, "No Votes to claim");
        uint256 balance = address(this).balance;
        require(balance > 10 ** 16, "Not enought balance to share");
        uint256 amount4Investor = (balance * INVESTOR_PERCENTAGE) / 100;
        balance = balance - amount4Investor;
        (bool success, ) = address(investorVaultAddress).call{
            value: amount4Investor
        }(abi.encodeWithSignature("receiveEther()"));
        if (!success) revert();

        uint256 share = balance.div(totalVotes);
        for (uint256 i = 0; i < eligibleToRewardMembers.length; i++) {
            payable(eligibleToRewardMembers[i]).transfer(
                share * voteMemberCounter[eligibleToRewardMembers[i]]
            );
        }
        resetEligibleRewardMembers();
    }

    function resetEligibleRewardMembers() private onlyMember {
        if (eligibleToRewardMembers.length > 0) {
            for (uint256 i = 0; i < eligibleToRewardMembers.length; i++) {
                voteMemberCounter[eligibleToRewardMembers[i]] = 0;
            }
        }
        delete eligibleToRewardMembers;
        totalVotes = 0;
        lastRewardClaim = block.timestamp;
    }

    modifier onlyMember() {
        require(members[msg.sender], "Caller is not a member");
        _;
    }

    modifier onlyAuthorizedContract() {
        require(
            authorizedContracts[msg.sender],
            "Caller is not an authorized contract"
        );
        _;
    }

    modifier afterDeadline(uint256 _deadlineDate) {
        require(_deadlineDate > block.timestamp + 300, "Deadline not valid");
        _;
    }

    modifier onlyAfterSevenDays() {
        require(
            block.timestamp >= lastRewardClaim + WAIT_TIME_REWARD,
            "ClaimReward: Must wait 7 days between claims"
        );
        _;
    }
}
