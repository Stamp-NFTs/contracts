'user strict';

/**
 * @author Cyril Lapinte - <cyril.lapinte@openfiz.com>
 */

const assertRevert = require('./helpers/assertRevert');
const BN = require('bn.js');
const MoonStampERC721Mock = artifacts.require('MoonStampERC721Mock.sol');

const FUTURE = Math.floor(new Date('9999-01-01').getTime() / 1000);
const TOMORROW = Math.floor(new Date().getTime() / 1000 + 3600 * 24);

const OPERATOR_SALE = '0x'.padEnd(42, '0');
const PUBLIC_SALE = '0x'.padEnd(42, 'f');

const PRICE_PER_TOKEN_ETH = web3.utils.toWei('1', 'ether');
const BASE_SUPPLY = 3000;
const NULL_ADDRESS = '0x'.padEnd(42, '0');

contract('MoonStampERC721', function (accounts) {
  let contract;

  beforeEach(async function () {
    contract = await MoonStampERC721Mock.new('MyToken', 'MTK', 'ipfs//myurl.org/', '.json', BASE_SUPPLY);
  });

  it('should prevent non owner to define a sale', async function () {
    await assertRevert(
      contract.defineSale(
        accounts[0], TOMORROW, FUTURE, PRICE_PER_TOKEN_ETH, 1000, { from: accounts[1] }),
      'OW01');
  });

  it('should allow operator to define a sale', async function () {
    const tx = await contract.defineSale(
      accounts[0], TOMORROW, FUTURE, PRICE_PER_TOKEN_ETH, 1000);
    assert.ok(tx.receipt.status, 'Status');
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'SaleDefined', 'event');
    assert.equal(tx.logs[0].args.signer, accounts[0], 'owner');
    assert.equal(tx.logs[0].args.startAt, TOMORROW, 'startAt');
    assert.equal(tx.logs[0].args.endAt, FUTURE, 'endAt');
    assert.equal(tx.logs[0].args.pricePerToken, PRICE_PER_TOKEN_ETH, 'price');
    assert.equal(tx.logs[0].args.supply, 1000, 'supply');
  });

  it('should prevent non operator to mint', async function () {
    await assertRevert(
      contract.mint(accounts[0], 2, 0, 0, '0x', { from: accounts[1] }),
      'MS05');
  });

  it('should let operator mint', async function () {
    const tx = await contract.mint(accounts[0], 2, 0, 0, '0x');
    assert.ok(tx.receipt.status, 'Status');
    assert.equal(tx.logs.length, 2);
    assert.equal(tx.logs[0].event, 'Transfer', 'event');
    assert.equal(tx.logs[0].args.from, NULL_ADDRESS, 'from');
    assert.equal(tx.logs[0].args.to, accounts[0], 'to');
    assert.equal(tx.logs[0].args.tokenId, 0, 'tokenId');
    assert.equal(tx.logs[1].event, 'Transfer', 'event');
    assert.equal(tx.logs[1].args.from, NULL_ADDRESS, 'from');
    assert.equal(tx.logs[1].args.to, accounts[0], 'to');
    assert.equal(tx.logs[1].args.tokenId, 1, 'tokenId');
  });

  describe('after operator mint first tokens', function () {
    beforeEach(async function () {
      await contract.mint(accounts[0], 2, 0, 0, '0x');
    });

    it('should have remaining supply', async function () {
      const saleDefinition = await contract.saleDefinitions(NULL_ADDRESS);
      assert.equal(saleDefinition.remainingSupply, 2998, 'remaining supply');
    });
  });

  describe('after operator define a public sale', function () {
    beforeEach(async function () {
      await contract.defineSale(
        PUBLIC_SALE, TOMORROW, FUTURE, PRICE_PER_TOKEN_ETH, 1000);
      await contract.defineSaleDates(PUBLIC_SALE, 0, FUTURE);
    });

    it('should let investor mint', async function () {
      const tx = await contract.mint(accounts[1], 2, 0, 0, '0x',
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) });
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, 'Transfer', 'event');
      assert.equal(tx.logs[0].args.from, NULL_ADDRESS, 'from');
      assert.equal(tx.logs[0].args.to, accounts[1], 'to');
      assert.equal(tx.logs[0].args.tokenId, 0, 'tokenId');
      assert.equal(tx.logs[1].event, 'Transfer', 'event');
      assert.equal(tx.logs[1].args.from, NULL_ADDRESS, 'from');
      assert.equal(tx.logs[1].args.to, accounts[1], 'to');
      assert.equal(tx.logs[1].args.tokenId, 1, 'tokenId');
    });
  });

  describe('after operator define a sale with "approval" required', function () {
    const approveTypes = [ 'address', 'address', 'uint8', 'uint64', 'uint64'];
    const approve = async function (values, approver) {
      const encodedParams = web3.eth.abi.encodeParameters(approveTypes, values);
      const hash = web3.utils.sha3(encodedParams, { encoding: 'hex' });
      return await web3.eth.sign(hash, approver);
    }

    beforeEach(async function () {
      await contract.defineSale(
        accounts[0], TOMORROW, FUTURE, PRICE_PER_TOKEN_ETH, 1000);
      await contract.defineSaleDates(accounts[0], 0, FUTURE);
    });

    it('should have let buyer come and mint himself tokens with approval', async function () {
      const approval = await approve([ contract.address, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
      const tx = await contract.mint(accounts[1], 2, TOMORROW, 1, approval,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) });
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, 'Transfer', 'event');
      assert.equal(tx.logs[0].args.from, NULL_ADDRESS, 'from');
      assert.equal(tx.logs[0].args.to, accounts[1], 'to');
      assert.equal(tx.logs[0].args.tokenId, 0, 'tokenId');
      assert.equal(tx.logs[1].event, 'Transfer', 'event');
      assert.equal(tx.logs[1].args.from, NULL_ADDRESS, 'from');
      assert.equal(tx.logs[1].args.to, accounts[1], 'to');
      assert.equal(tx.logs[1].args.tokenId, 1, 'tokenId');
    });

    describe('and after the buyer minted its first token', function () {
      let approval;
      
      beforeEach(async function () {
        approval = await approve([ contract.address, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
        await contract.mint(accounts[1], 2, TOMORROW, 1, approval,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) });
      });

      it('should not let buyer reuse the approval a seocnd time', async function () {
        await assertRevert(contract.mint(accounts[1], 2, TOMORROW, 1, approval,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) }), 'MS03');
      });
    });
  });
});
