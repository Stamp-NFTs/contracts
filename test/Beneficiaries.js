'user strict';

/**
 * @author Cyril Lapinte - <cyril.lapinte@openfiz.com>
 */

const assertRevert = require('./helpers/assertRevert');
const Beneficiaries = artifacts.require('BeneficiariesMock.sol');

const NULL_ADDRESS = '0x'.padEnd(42, '0');
const WEI = 3333;

contract('Beneficiaries', function (accounts) {
  let contract;

  beforeEach(async function () {
    contract = await Beneficiaries.new();
  });

  it('should let owner to define the beneficiaries', async function () {
    const tx = await contract.defineBeneficiaries([ accounts[0], accounts[1] ]);
    assert.ok(tx.receipt.status, 'Status');
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'BeneficiariesDefined', 'event');
    assert.deepEqual(tx.logs[0].args.addresses, [ accounts[0], accounts[1] ], 'beneficiaries');
  });

  it('should prevent non owner to define beneficiaries', async function () {
    await assertRevert(
      contract.defineBeneficiaries([ accounts[1] ], { from: accounts[1] }),
      'OW01');
  });

  it('should not allow operator to withdrawETH', async function () {
    await assertRevert(contract.withdrawETH(), 'BE01');
  });

  it('should prevent non operator to withdraw ETH', async function () {
    await assertRevert(contract.withdrawETH({ from: accounts[1] }), 'OP01');
  });

  describe('with beneficiaries defined and some ETH received by the contract', function () {
    beforeEach(async function () {
      await contract.defineBeneficiaries([ accounts[0], accounts[1] ]);
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: contract.address,
        value: WEI,
      });
    });

    it('should allow operator to withdrawETH', async function () {
      const tx = await contract.withdrawETH();
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 0);

      const balance = await web3.eth.getBalance(contract.address);
      assert.equal(balance, 1, 'balance');
    });
  });
});
