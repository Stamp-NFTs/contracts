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
 *  MS01: The sale must be defined in the future
 *  MS02: The sale must not be started
 *  MS03: The signature is not valid anymore
 *  MS04: Enough ethers must be provided
 *  MS05: The sale is close
 *  MS06: No more tokens are available 
 */
contract MoonStampERC721 is Pausable, Beneficiaries, TokenERC721 {
  using SignerRecovery for bytes;

  event SaleDefined(
    address signer,
    uint64 startAt,
    uint64 endAt,
    uint256 pricePerToken,
    uint256 supply);

  address internal constant OPERATOR_DEFINITION = address(0);
  address internal constant NOSIGNER_DEFINITION = address(~uint160(0));

  struct SaleDefinition {
    uint64 startAt;
    uint64 endAt;

    uint256 pricePerToken;
    uint256 remainingSupply;
  }

  // A definition may exist for different signers
  // Two special definitions exist:
  // OPERATOR_DEFINITION: operators may have a minting allowance
  // NOSIGNER_DEFINIITON: if no signer approval is provided
  mapping(address => SaleDefinition) public saleDefinitions;
  mapping(bytes32 => bool) internal transactions;

  constructor() TokenERC721("MoonStamp", "MSP", "", "", address(0), new uint256[](0)) {
    saleDefinitions[OPERATOR_DEFINITION] = SaleDefinition(uint64(0), ~uint64(0), 10**18, 3000);
  }

  /**
   * @dev defineSale
   */
  function defineSale(
    address _signer,
    uint64 _startAt,
    uint64 _endAt,
    uint256 _pricePerToken,
    uint256 _supply) external onlyOwner returns (bool)
  {
    // solhint-disable-next-line
    uint256 time = block.timestamp;
    require(_startAt > time && _startAt <= _endAt, "MS01");
    require (saleDefinitions[_signer].startAt == 0
      || saleDefinitions[_signer].startAt > time, "MS02");
    saleDefinitions[_signer] =
      SaleDefinition(_startAt, _endAt, _pricePerToken, _supply);

    emit SaleDefined(
      _signer, _startAt, _endAt, _pricePerToken, _supply);
    return true;
  }

  /**
   * @dev mint
   */
  function mint(
    address _recipient,
    uint8 _quantity,
    uint64 _signatureValidity,
    uint64 _signatureNonce,
    bytes memory _signature) external payable whenNotPaused returns (bool)
  {
    // solhint-disable-next-line
    uint256 time = block.timestamp;

    SaleDefinition storage saleDefinition; 
    if (!isOperator(msg.sender)) {
      if (_signature.length == 0) {
        saleDefinition = saleDefinitions[NOSIGNER_DEFINITION];
      } else {
        bytes32 hash = keccak256(abi.encode(
          address(this), msg.sender, _quantity, _signatureValidity, _signatureNonce)
        );

        address signer = _signature.recoverSigner(hash);
        saleDefinition = saleDefinitions[signer];

        require(_signatureValidity >= time, "MS03");
        transactions[hash] = true;
      }

      require(msg.value >= _quantity * saleDefinition.pricePerToken, "MS04");
    } else {
      saleDefinition = saleDefinitions[OPERATOR_DEFINITION];
    }

    require(time > saleDefinition.startAt
      && time <= saleDefinition.endAt, "MS05");
    require(_quantity <= saleDefinition.remainingSupply, "MS06");

    uint256[] memory tokenIds = new uint256[](_quantity);
    for(uint256 i=0; i < _quantity; i++) {
      tokenIds[i] = i + totalSupply_;
    }

    mintInternal(_recipient, tokenIds);
    return true;
  }
}
