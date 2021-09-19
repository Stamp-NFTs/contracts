'user strict';

/**
 * @author Cyril Lapinte - <cyril.lapinte@openfiz.com>
 */

const assertRevert = require('./helpers/assertRevert');
const MoonStampERC721 = artifacts.require('MoonStampERC721.sol');

const FUTURE = Math.floor(new Date('9999-01-01').getTime() / 1000);
const TOMORROW = Math.floor(new Date().getTime() / 1000 + 3600 * 24);

const PRICE_PER_TOKEN_ETH = web3.utils.toWei('1', 'ether');
const NULL_ADDRESS = '0x'.padEnd(42, '0');

contract('MoonStampERC721', function (accounts) {
  let contract;

  beforeEach(async function () {
    contract = await MoonStampERC721.new();
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
});
