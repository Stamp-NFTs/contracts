pragma solidity ^0.8.0;

import "@c-layer/common/contracts/token/TokenERC721.sol";
import "@c-layer/common/contracts/lifecycle/Pausable.sol";
import "@c-layer/common/contracts/signer/SignerRecovery.sol";
import "./Beneficiaries.sol";


/**
 * @title MoonStampERC721 contract
 *
 * @author Cyril Lapinte - <cyril.lapinte@openfiz.com>
 * SPDX-License-Identifier: MIT
 * 
 * Error messages
 *  MS01: The saleId must be valid
 *  MS02: The sale must not be started
 *  MS03: Sale is not public
 *  MS04: Invalid signature
 *  MS05: The signature is not valid anymore
 *  MS06: The sale must be defined in the future
 *  MS07: Inconsistent price definitions
 *  MS08: The sale is close
 *  MS09: Enough ethers must be provided
 *  MS10: Not enought tokens are available
 */
contract MoonStampERC721 is Pausable, Beneficiaries, TokenERC721 {
  using SignerRecovery for bytes;

  address internal constant OPERATOR_DEFINITION = address(0);
  address internal constant NO_SIGNER_DEFINITION = address(~uint160(0));

  event SaleDefined(
    uint32 saleId,
    address signer,
    uint64 startAt,
    uint64 endAt,
    uint256[] tokenPrices,
    uint256[] supplies);

  event SaleUpdated(
    uint32 saleId,
    address signer,
    uint64 startAt,
    uint64 endAt,
    uint256[] tokenPrices,
    uint256[] supplies);

  struct PriceDefinition {
    uint256 tokenPrice;
    uint256 remainingSupply;
  }

  struct SaleDefinition {
    address signer;
    uint64 startAt;
    uint64 endAt;

    PriceDefinition[] priceDefinitions;
  }

  // A definition may exist for different signers
  // Two special definitions exist:
  // OPERATOR_DEFINITION: only operators may have a minting allowance
  // NO_SIGNER_DEFINIITON: no signer approval is required
  SaleDefinition[] internal saleDefinitions;
  mapping(address => uint256) public minted;

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _baseURI,
    string memory _suffixURI,
    uint256 _supply
  ) TokenERC721(_name, _symbol, _baseURI, _suffixURI, address(0), new uint256[](0)) {
    uint256[] memory supplies = new uint256[](1);
    supplies[0] = _supply;

    defineSale(
      OPERATOR_DEFINITION,
      uint64(block.timestamp), //solhint-disable-line
      ~uint64(0),
      new uint256[](1),
      supplies);
  }

  /**
   * @dev saleDefinition
   */
  function saleDefinition(uint16 _sale) public view returns (
    address signer,
    uint64 startAt,
    uint64 endAt,
    uint256[] memory tokenPrices,
    uint256[] memory remainingSupplies)
  {
    SaleDefinition storage saleDefinition_ = saleDefinitions[_sale];

    tokenPrices = new uint256[](saleDefinition_.priceDefinitions.length);
    remainingSupplies = new uint256[](saleDefinition_.priceDefinitions.length);
    for(uint256 i=0; i < saleDefinition_.priceDefinitions.length; i++) {
      tokenPrices[i] = saleDefinition_.priceDefinitions[i].tokenPrice;
      remainingSupplies[i] = saleDefinition_.priceDefinitions[i].remainingSupply;
    }

    return (saleDefinition_.signer,
      saleDefinition_.startAt,
      saleDefinition_.endAt,
      tokenPrices,
      remainingSupplies);
  }

  /**
   * @dev defineURI
   */
  function defineURI(string memory _baseURI, string memory _suffixURI)
    external onlyOwner returns (bool)
  {
    baseURI_ = _baseURI;
    suffixURI_ = _suffixURI;
    emit TemplateURIUpdated(_baseURI, _suffixURI);
    return true;
  }

  /**
   * @dev defineSale
   */
  function defineSale(
    address _signer,
    uint64 _startAt,
    uint64 _endAt,
    uint256[] memory _tokenPrices,
    uint256[] memory _supplies) public onlyOwner returns (bool)
  {
    saleDefinitions.push();
    uint32 saleId = uint32(saleDefinitions.length)-1;
    updateSaleInternal(
      saleId, _signer, _startAt, _endAt, _tokenPrices, _supplies);
    emit SaleDefined(saleId, _signer, _startAt, _endAt, _tokenPrices, _supplies);
    return true;
  }

  /**
   * @dev updateSale
   */
  function updateSale(
    uint32 _saleId,
    address _signer,
    uint64 _startAt,
    uint64 _endAt,
    uint256[] calldata _tokenPrices,
    uint256[] calldata _supplies) external onlyOwner returns (bool)
  {
    require(_saleId < saleDefinitions.length, "MS01");
    uint64 startAt = saleDefinitions[_saleId].startAt;
    // solhint-disable-next-line
    require (startAt == 0 || startAt > block.timestamp, "MS02");
    updateSaleInternal(_saleId, _signer, _startAt, _endAt, _tokenPrices, _supplies);

    emit SaleUpdated(
      _saleId, _signer, _startAt, _endAt, _tokenPrices, _supplies);
    return true;
  }

  /**
   * @dev mint
   */
  function mint(
    uint32 _sale,
    address _recipient,
    uint256 _quantity) external payable whenNotPaused returns (bool)
  {
    if (!isOperator(msg.sender)) {
      require(saleDefinitions[_sale].signer == NO_SIGNER_DEFINITION, "MS03");
    }
    return mintInternal(_sale, _recipient, _quantity);
  }

  /**
   * @dev mintWithApproval
   */
  function mintWithApproval(
    uint32 _sale,
    address _recipient,
    uint8 _quantity,
    uint64 _signatureValidity,
    bytes memory _signature) external payable whenNotPaused returns (bool)
  {
    bytes32 hash = keccak256(abi.encode(
      address(this), _sale, msg.sender, _quantity, _signatureValidity, minted[msg.sender])
    );

    address signer = _signature.recoverSigner(hash);
    require(saleDefinitions[_sale].signer == signer, "MS04");

    // solhint-disable-next-line
    require(_signatureValidity >= block.timestamp, "MS05");

    return mintInternal(_sale, _recipient, _quantity);
  }

  /**
   * @dev updateSaleInternal
   */
  function updateSaleInternal(
    uint32 _saleId,
    address _signer,
    uint64 _startAt,
    uint64 _endAt,
    uint256[] memory _tokenPrices,
    uint256[] memory _supplies) internal
  {
    // solhint-disable-next-line
    require(_startAt >= block.timestamp && _startAt <= _endAt, "MS06");
    require(_tokenPrices.length == _supplies.length, "MS07");

    SaleDefinition storage saleDefinition_ = saleDefinitions[_saleId];
    saleDefinition_.signer = _signer;
    saleDefinition_.startAt = _startAt;
    saleDefinition_.endAt = _endAt;

    PriceDefinition[] storage priceDefinitions =
      saleDefinition_.priceDefinitions;
    delete saleDefinition_.priceDefinitions;
    for(uint256 i=0; i< _tokenPrices.length; i++) {
      priceDefinitions.push(
        PriceDefinition(_tokenPrices[i], _supplies[i]));
    }
  }

  /*
   * @dev mintInternal
   */
  function mintInternal(
    uint32 _sale,
    address _recipient,
    uint256 _quantity) internal returns (bool)
  {
    SaleDefinition storage saleDefinition_ = saleDefinitions[_sale];

    // solhint-disable-next-line
    uint256 time = block.timestamp;
    require(time > saleDefinition_.startAt
      && time <= saleDefinition_.endAt, "MS08");

    uint256 quantity = _quantity;
    uint256 price;
    for(uint256 i=0; i < saleDefinition_.priceDefinitions.length && quantity != 0; i++) {
      PriceDefinition storage priceDefinition = saleDefinition_.priceDefinitions[i];
      if (priceDefinition.remainingSupply != 0) {
        uint256 quantityAtPrice = (quantity > priceDefinition.remainingSupply) ? priceDefinition.remainingSupply : quantity;
        price += quantityAtPrice * priceDefinition.tokenPrice;
        quantity -= quantityAtPrice;
        priceDefinition.remainingSupply -= quantityAtPrice;
      }
    }

    if(!isOperator(msg.sender)) {
      require(msg.value >= price, "MS09");
    }
    require(quantity == 0, "MS10");

    minted[msg.sender] += _quantity;
    uint256[] memory tokenIds = new uint256[](_quantity);
    for(uint256 i=0; i < _quantity; i++) {
      tokenIds[i] = i + totalSupply_;
    }

    super.mintInternal(_recipient, tokenIds);
    return true;
  }
}
