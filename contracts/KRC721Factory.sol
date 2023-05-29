// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./KRC721.sol";

contract KRC721Factory {
    event NewKRC721(
        string name,
        string symbol,
        address owner,
        address indexed krc721addr
    );

    address private owner;
    address private krc20_addr;
    mapping(address => bool) private unauthorizedCreators;
    mapping(address => bool) private authorizedMembers;

    constructor(address _krc20_addr) {
        authorizedMembers[msg.sender] = true;
        owner = msg.sender;
        krc20_addr = _krc20_addr;
    }

    modifier onlyAuthorizedCreators() {
        require(
            !unauthorizedCreators[msg.sender],
            "KRC721 Factory: Caller is not authorized"
        );
        _;
    }

    modifier onlyAuthorizedMembers() {
        require(
            authorizedMembers[msg.sender],
            "KRC721 Factory: Caller is not authorized"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is authorized");
        _;
    }

    function addAuthorizedMember(address member) public onlyOwner {
        authorizedMembers[member] = true;
    }

    function removeAuthorizedMember(address member) public onlyOwner {
        authorizedMembers[member] = false;
    }

    function addAuthorizedCreator(
        address creator
    ) public onlyAuthorizedMembers {
        unauthorizedCreators[creator] = false;
    }

    function removeAuthorizedCreator(
        address creator
    ) public onlyAuthorizedMembers {
        unauthorizedCreators[creator] = true;
    }

    function isAuthorizedMember(address member) public view returns (bool) {
        return authorizedMembers[member];
    }

    function isAuthorizedCreator(address creator) public view returns (bool) {
        return !unauthorizedCreators[creator];
    }

    function createKRC721(
        address _owner,
        string memory name,
        string memory symbol,
        uint256 maxCollectionSupply,
        uint256 saleCommissionPercentage,
        uint256 krmCommissionPercentage,
        uint256 artistCommissionPercentage,
        address beneficiaryAddress,
        bool isKrc20
    ) public onlyAuthorizedCreators {
        KRC721 krc721 = new KRC721(
            _owner,
            name,
            symbol,
            maxCollectionSupply,
            saleCommissionPercentage,
            krmCommissionPercentage,
            artistCommissionPercentage,
            beneficiaryAddress,
            krc20_addr,
            isKrc20
        );
        if (isKrc20) {
            (bool success, ) = address(krc20_addr).call(
                abi.encodeWithSignature(
                    "addContractProposal(address,string,string,uint256)",
                    address(krc721),
                    string(abi.encodePacked(name, " - ", symbol)),
                    "Generated from CreateKRC721",
                    block.timestamp + 2592000
                )
            );
            require(success, "Contract proposal failed");
        }
        emit NewKRC721(name, symbol, _owner, address(krc721));
    }
}
