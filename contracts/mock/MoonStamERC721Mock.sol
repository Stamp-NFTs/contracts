pragma solidity ^0.8.0;

import "../MoonStampERC721.sol";


/**
 * @title MoonStampERC721Mock
 * @dev MoonStampERC721Mock
 * @author Cyril Lapinte - <cyril@openfiz.com>
 * SPDX-License-Identifier: MIT
 *
 * Error messages
 */
contract MoonStampERC721Mock is MoonStampERC721 {

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _baseURI,
    string memory _suffixURI,
    uint256 _supply
  ) MoonStampERC721(_name, _symbol, _baseURI, _suffixURI, _supply) {
  }

  /**
   * @dev defineSaleDates function
   */
  function defineSaleDates(uint16 _sale, uint64 _startAt, uint64 _endAt) external {
    saleDefinitions[_sale].startAt = _startAt;
    saleDefinitions[_sale].endAt = _endAt;
  }
}
