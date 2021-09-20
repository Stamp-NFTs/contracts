pragma solidity ^0.8.0;

import "@c-layer/common/contracts/operable/Operable.sol";


/**
 * @title Beneficiaries
 * @dev Beneficiaries
 * @author Cyril Lapinte - <cyril@openfiz.com>
 * SPDX-License-Identifier: MIT
 *
 * Error messages
 *   BE01: Beneficiary must be defined
 *   BE02: No ETH to transfer
 */
contract Beneficiaries is Operable {

  event BeneficiariesDefined(address payable[] addresses);

  address payable[] private beneficiaries;

  /*
   * @dev defineBeneficiaries
   */
  function defineBeneficiaries(address payable[] memory _addresses)
    public onlyOwner returns (bool)
  {
    beneficiaries = _addresses;
    emit BeneficiariesDefined(_addresses);
    return true;
  }

  /**
   * @dev withdrawETH
   * @dev Disclaimer: no guarantees are provided with this method
   * @dev This method may fail during any ETH transfer if ever:
   * @dev it runs out of gas
   * @dev or if the stack becomes too deep
   * @dev It is the responsability of the user to ensure it works properly
   */
  function withdrawETH() public onlyOperator returns (bool)
  {
    require(beneficiaries.length > 0, "BE01");
    uint256 value = address(this).balance / beneficiaries.length;
    require(value > 0, "BE02");
    for(uint256 i=0; i < beneficiaries.length; i++) {
      // solhint-disable-next-line avoid-call-value, avoid-low-level-calls
      beneficiaries[i].transfer(value);
    }
    return true;
  }
}
