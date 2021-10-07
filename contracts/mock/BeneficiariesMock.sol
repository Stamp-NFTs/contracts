pragma solidity ^0.8.0;

import "../Beneficiaries.sol";


/**
 * @title BeneficiariesMock
 * @dev BeneficiariesMock
 * @author Cyril Lapinte - <cyril@openfiz.com>
 * SPDX-License-Identifier: MIT
 *
 * Error messages
 */
contract BeneficiariesMock is Beneficiaries {
  /**
   * @dev receive function
   */
  //solhint-disable-next-line no-complex-fallback
  receive() external payable {
    //updateWithdrawable();
  }
}
