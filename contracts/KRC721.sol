// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract KRC721 is ERC721URIStorage {
    event Purchase(
        address indexed buyer,
        address seller,
        uint256 tokenId,
        uint256 price
    );
    event Mint(uint256 tokenId, string tokenURI);
    event CollectionGalleryUpdate(uint256 tokenId, string tokenURI);

    address private krc20Address;

    uint256 private nextTokenId;
    uint256 private maxCollectionSupply;
    uint256 private saleCommissionPercentage;
    uint256 private beneficiaryCommissionPercentage;
    uint256 private krmCommissionPercentage;
    uint256 public collectionPrice;
    bool private isKrc20;
    address public owner;
    address private beneficiaryAddress;
    mapping(uint256 => uint256) private salePrices;
    mapping(uint256 => string[]) private collectionGalleries;

    constructor(
        address _owner,
        string memory _name,
        string memory _symbol,
        uint256 _maxCollectionSupply,
        uint256 _saleCommissionPercentage,
        uint256 _krmCommissionPercentage,
        uint256 _beneficiaryPercentage,
        address _beneficiaryAddress,
        address _krc20Address,
        bool _isKrc20
    ) ERC721(_name, _symbol) {
        require(
            _saleCommissionPercentage +
                _krmCommissionPercentage +
                beneficiaryCommissionPercentage <
                95,
            "Commissions > 95%"
        );
        if (_beneficiaryAddress == address(0) && _beneficiaryPercentage > 0) {
            revert("Invalid beneficiary params");
        }
        require(_krmCommissionPercentage > 0, "Invalid krm percentage");

        nextTokenId = 1;
        maxCollectionSupply = _maxCollectionSupply;
        saleCommissionPercentage = _saleCommissionPercentage;
        krmCommissionPercentage = _krmCommissionPercentage;
        beneficiaryCommissionPercentage = _beneficiaryPercentage;
        krc20Address = _krc20Address;
        isKrc20 = _isKrc20;
        beneficiaryAddress = _beneficiaryAddress;
        owner = _owner;
    }

    function mintWithTokenURI(
        address to,
        string memory tokenURI
    ) public onlyAuthorized {
        require(nextTokenId < maxCollectionSupply, "Collection supply reached");
        uint256 tokenId = nextTokenId;
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        emit Mint(nextTokenId, tokenURI);
        nextTokenId = nextTokenId + 1;
    }

    function collectionGalleryUpdate(
        uint256 tokenId,
        string memory URI
    ) public onlyAuthorized {
        string[] storage collectionGallery = collectionGalleries[tokenId];
        collectionGallery.push(URI);
        emit CollectionGalleryUpdate(tokenId, URI);
    }

    function getCollectionGallery(
        uint256 tokenId
    ) public view returns (string[] memory) {
        return collectionGalleries[tokenId];
    }

    function setSalePrice(uint256 tokenId, uint256 price) public {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Caller is not owner nor approved"
        );
        salePrices[tokenId] = price;
    }

    function buy(uint256 tokenId) public payable {
        uint256 salePrice = salePrices[tokenId];
        require(salePrice > 0, "Token is not for sale");
        require(msg.value >= salePrice, "Insufficient funds");
        address seller = ownerOf(tokenId);
        _transfer(seller, msg.sender, tokenId);

        uint256 ownerCommission = (salePrice * saleCommissionPercentage) / 100;
        uint256 krmDonation = (salePrice * krmCommissionPercentage) / 100;
        uint256 beneficiaryCommission = (salePrice *
            beneficiaryCommissionPercentage) / 100;
        uint256 sellerProceeds = salePrice -
            ownerCommission -
            krmDonation -
            beneficiaryCommission;

        if (sellerProceeds > 0) {
            payable(seller).transfer(sellerProceeds);
        }
        if (ownerCommission > 0) {
            payable(owner).transfer(ownerCommission);
        }
        if (beneficiaryCommission > 0 && beneficiaryAddress != address(0)) {
            payable(beneficiaryAddress).transfer(beneficiaryCommission);
        }
        salePrices[tokenId] = 0;
        if (isKrc20) {
            (bool success, ) = address(krc20Address).call{value: krmDonation}(
                abi.encodeWithSignature(
                    "mint(address,address)",
                    msg.sender,
                    seller
                )
            );
            require(success == true, "Mint operation failed");
        }
        if (msg.value > salePrice) {
            uint256 change = msg.value -
                sellerProceeds -
                krmDonation -
                ownerCommission;
            payable(msg.sender).transfer(change);
        }
        emit Purchase(msg.sender, seller, tokenId, salePrice);
    }

    function tokenSalePrice(uint256 tokenId) public view returns (uint256) {
        return salePrices[tokenId];
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal {
        super._beforeTokenTransfer(from, to, tokenId, 1);

        if (from != address(0) && to != address(0)) {
            require(salePrices[tokenId] == 0, "Token must not be for sale");
        }
    }

    function setCollectionPrice(uint256 price) public onlyAuthorized {
        collectionPrice = price;
    }

    function buyCollection() public payable {
        require(collectionPrice > 0, "Not for sale");
        require(msg.value >= collectionPrice, "Insufficient funds");
        payable(owner).transfer(collectionPrice);
        if (msg.value - collectionPrice > 0) {
            payable(msg.sender).transfer(msg.value - collectionPrice);
        }
        owner = msg.sender;
    }

    function isAuthorizedMember(address member) public view returns (bool) {
        return member == owner;
    }

    function getBeneficiaryAddress() public view returns (address) {
        return beneficiaryAddress;
    }

    function getCirculatingSupply() public view returns (uint256) {
        return nextTokenId - 1;
    }

    function getCommissionPercentages()
        public
        view
        returns (uint256, uint256, uint256, uint256)
    {
        return (
            saleCommissionPercentage,
            beneficiaryCommissionPercentage,
            krmCommissionPercentage,
            100 -
                saleCommissionPercentage -
                beneficiaryCommissionPercentage -
                krmCommissionPercentage
        );
    }

    function getKRC20Address() public view returns (address) {
        return krc20Address;
    }

    function getMaxCollectionSupply() public view returns (uint256) {
        return maxCollectionSupply;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner, "Caller is not authorized");
        _;
    }
}
