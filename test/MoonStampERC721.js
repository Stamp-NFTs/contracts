'user strict';

/**
 * @author Cyril Lapinte - <cyril.lapinte@openfiz.com>
 */

const assertRevert = require('./helpers/assertRevert');
const BN = require('bn.js');
const MoonStampERC721Mock = artifacts.require('MoonStampERC721Mock.sol');

const BASE_URI = 'ipfs//myurl.org/';
const SUFFIX_URI = '.jons';

const YERSTEDAY = Math.floor(Math.floor(new Date().getTime() / 1000 - 3600 * 24));
const TOMORROW = Math.floor(new Date().getTime() / 1000 + 3600 * 24);
const FUTURE = Math.floor(new Date('9999-01-01').getTime() / 1000);

const PUBLIC_SALE = '0x'.padEnd(42, 'f');

const PRICE_PER_TOKEN_ETH = web3.utils.toWei('1', 'ether');
const BASE_SUPPLY = '3000';
const NULL_ADDRESS = '0x'.padEnd(42, '0');

contract('MoonStampERC721', function (accounts) {
  let contract;

  beforeEach(async function () {
    contract = await MoonStampERC721Mock.new('MyToken', 'MTK', BASE_URI, SUFFIX_URI, BASE_SUPPLY);
  });

  it('should have a sale defined', async function () {
    const saleDefinition = await contract.saleDefinition(0);
    assert.equal(saleDefinition.signer, NULL_ADDRESS, 'signer');

    const startAt = (await web3.eth.getBlock('latest')).timestamp;
    assert.equal(saleDefinition.startAt, startAt, 'startAt');
    assert.equal(saleDefinition.endAt, 0xffffffffffffffff, 'endAt');
    assert.deepEqual(saleDefinition.tokenPrices.map((x) => x.toString()),
      [ '0' ], 'tokenPrices');
    assert.deepEqual(saleDefinition.remainingSupplies.map((x) => x.toString()),
      [ BASE_SUPPLY ], 'remainingSupplies');
  });

  it('should prevent non owner to define a sale', async function () {
    await assertRevert(
      contract.defineSale(
        accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ], { from: accounts[1] }),
      'OW01');
  });

  it('should prevent to define a sale with a negative interval', async function () {
    await assertRevert(
      contract.defineSale(
        accounts[0], FUTURE, TOMORROW, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]),
      'MS06');
  });

  it('should prevent to define a sale in the past', async function () {
    await assertRevert(
      contract.defineSale(
        accounts[0], YERSTEDAY, TOMORROW, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]),
      'MS06');
  });

  it('should allow operator to define a sale', async function () {
    const tx = await contract.defineSale(
      accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]);
    assert.ok(tx.receipt.status, 'Status');
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'SaleDefined', 'event');
    assert.equal(tx.logs[0].args.signer, accounts[0], 'owner');
    assert.equal(tx.logs[0].args.startAt, TOMORROW, 'startAt');
    assert.equal(tx.logs[0].args.endAt, FUTURE, 'endAt');
    assert.deepEqual(tx.logs[0].args.tokenPrices.map((x) => x.toString()), [ PRICE_PER_TOKEN_ETH ], 'price');
    assert.deepEqual(tx.logs[0].args.supplies.map((x) => x.toString()), [ '1000' ], 'supply');
  });

  it('should prevent non operator to mint', async function () {
    await assertRevert(
      contract.mint(0, accounts[0], 2, { from: accounts[1] }),
      'MS03');
  });

  it('should prevent operator to mint too many tokens', async function () {
    await assertRevert(contract.mint(0, accounts[0], new BN(BASE_SUPPLY).add(new BN('1'))), 'MS10');
  });

  it('should let operator mint', async function () {
    const tx = await contract.mint(0, accounts[0], 2);
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

  it('should prevent non owner to define URI', async function () {
    await assertRevert(
      contract.defineURI(BASE_URI, SUFFIX_URI, { from: accounts[1] }),
      'OW01');
  });

  it('should let owner define URI', async function () {
    const tx = await contract.defineURI(BASE_URI, SUFFIX_URI);
    assert.ok(tx.receipt.status, 'Status');
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'TemplateURIUpdated', 'event');
    assert.equal(tx.logs[0].args.baseURI_, BASE_URI, 'baseURI');
    assert.equal(tx.logs[0].args.suffixURI_, SUFFIX_URI, 'suffixURI');
  });

  describe('after operator mint first tokens', function () {
    beforeEach(async function () {
      await contract.mint(0, accounts[0], 2);
    });

    it('should have remaining supply', async function () {
      const saleDefinition = await contract.saleDefinition(0);
      assert.equal(saleDefinition.remainingSupplies[0], 2998, 'remaining supply');
    });
  });

  describe('after an operator has defined a sale', function () {
    beforeEach(async function () {
      await contract.defineSale(
        PUBLIC_SALE, TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]);
    });

    it('should have a public sale defined', async function () {
      const saleDefinition = await contract.saleDefinition(1);
      assert.equal(saleDefinition.signer.toLowerCase(), PUBLIC_SALE, 'signer');
      assert.equal(saleDefinition.startAt, TOMORROW, 'startAt');
      assert.equal(saleDefinition.endAt, FUTURE, 'endAt');
      assert.deepEqual(saleDefinition.tokenPrices.map((x) => x.toString()),
        [ PRICE_PER_TOKEN_ETH ], 'tokenPrices');
      assert.deepEqual(saleDefinition.remainingSupplies.map((x) => x.toString()),
        [ '1000' ], 'remainingSupplies');
    });

    it('should prevent non owner to update a sale', async function () {
      await assertRevert(
        contract.updateSale(
          1, accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ], { from: accounts[1] }),
        'OW01');
    });

    it('should prevent to update a non existent sale', async function () {
      await assertRevert(
        contract.updateSale(
          2, accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]),
        'MS01');
    });

    it('should prevent to update a sale with a negative interval', async function () {
      await assertRevert(
        contract.updateSale(
          1, accounts[0], FUTURE, TOMORROW, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]),
        'MS06');
    });

    it('should prevent to update a sale in the past', async function () {
      await assertRevert(
        contract.updateSale(
          1, accounts[0], YERSTEDAY, TOMORROW, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]),
        'MS06');
    });

    it('should allow operator to update a sale', async function () {
      const tx = await contract.updateSale(
        1, accounts[1], TOMORROW + 1, FUTURE + 1, [ new BN(PRICE_PER_TOKEN_ETH).add(new BN('2')) ], [ 1001 ]);
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, 'SaleUpdated', 'event');
      assert.equal(tx.logs[0].args.signer, accounts[1], 'owner');
      assert.equal(tx.logs[0].args.startAt, TOMORROW + 1, 'startAt');
      assert.equal(tx.logs[0].args.endAt, FUTURE + 1, 'endAt');
      assert.deepEqual(tx.logs[0].args.tokenPrices.map((x) => x.toString()),
        [ new BN(PRICE_PER_TOKEN_ETH).add(new BN('2')).toString() ], 'price');
      assert.deepEqual(tx.logs[0].args.supplies.map((x) => x.toString()), [ '1001' ], 'supply');
    });
  });

  describe('after a public sale has started', function () {
    beforeEach(async function () {
      await contract.defineSale(
        PUBLIC_SALE, TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]);
      await contract.defineSaleDates(1, 0, FUTURE);
    });

    it('should prevent non owner to update a sale', async function () {
      await assertRevert(
        contract.updateSale(
          1, accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ], { from: accounts[1] }),
        'OW01');
    });

    it('should let investor mint', async function () {
      const tx = await contract.mint(1, accounts[1], 2,
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

  describe('after a public sale with multple prices has started', function () {
    beforeEach(async function () {
      await contract.defineSale(
        PUBLIC_SALE, TOMORROW, FUTURE,
        [ PRICE_PER_TOKEN_ETH, new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) ],
        [ 2, 3 ]);
      await contract.defineSaleDates(1, 0, FUTURE);
    });

    it('should prevent minting within the first price below the price', async function () {
      await assertRevert(contract.mint(1, accounts[1], 2,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')).sub(new BN('1')) }), 'MS09');
    });

    it('should let investor mint within the first price', async function () {
      const tx = await contract.mint(1, accounts[1], 2,
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

    it('should prevent minting within the first price below the price', async function () {
      await assertRevert(contract.mint(1, accounts[1], 3,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('4')).sub(new BN('1')) }), 'MS09');
    });

    it('should let investor mint within the seconds price', async function () {
      const tx = await contract.mint(1, accounts[1], 3,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('4')) });
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 3);
      for (let i = 0; i < tx.logs.length; i++) {
        assert.equal(tx.logs[i].event, 'Transfer', 'event');
        assert.equal(tx.logs[i].args.from, NULL_ADDRESS, 'from');
        assert.equal(tx.logs[i].args.to, accounts[1], 'to');
        assert.equal(tx.logs[i].args.tokenId, i, 'tokenId');
      }
    });

    describe('after minting within the seconds price', function () {
      beforeEach(async function () {
        await contract.mint(1, accounts[1], 3,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('4')) });
      });

      it('should have some tokens available', async function () {
        const saleDefinition = await contract.saleDefinition(1);
        assert.deepEqual(saleDefinition.remainingSupplies.map((supply) => supply.toString()),
          [ '0', '2' ]);
      });
    });

    it('should prevent minting within all tokens below the price', async function () {
      await assertRevert(contract.mint(1, accounts[1], 5,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('8')).sub(new BN('1')) }), 'MS09');
    });

    it('should let investor mint all tokens', async function () {
      const tx = await contract.mint(1, accounts[1], 5,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('8')) });
      assert.ok(tx.receipt.status, 'Status');
      assert.equal(tx.logs.length, 5);
      for (let i = 0; i < tx.logs.length; i++) {
        assert.equal(tx.logs[i].event, 'Transfer', 'event');
        assert.equal(tx.logs[i].args.from, NULL_ADDRESS, 'from');
        assert.equal(tx.logs[i].args.to, accounts[1], 'to');
        assert.equal(tx.logs[i].args.tokenId, i, 'tokenId');
      }
    });
  });

  describe('after a sale with "approval" required has started', function () {
    const approveTypes = [ 'address', 'uint32', 'address', 'uint8', 'uint64', 'uint64'];
    const approve = async function (values, approver) {
      const encodedParams = web3.eth.abi.encodeParameters(approveTypes, values);
      const hash = web3.utils.sha3(encodedParams, { encoding: 'hex' });
      return await web3.eth.sign(hash, approver);
    };

    beforeEach(async function () {
      await contract.defineSale(
        accounts[0], TOMORROW, FUTURE, [ PRICE_PER_TOKEN_ETH ], [ 1000 ]);
      await contract.defineSaleDates(1, 0, FUTURE);
    });

    it('should not allow to mint without approval', async function () {
      await assertRevert(contract.mint(1, accounts[1], 2,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) }), 'MS03');
    });

    it('should not allow to mint with an invalid approval', async function () {
      const approval = await approve([ contract.address, 1, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
      await assertRevert(contract.mintWithApproval(1, accounts[1], 3, TOMORROW, 1, approval,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) }), 'MS04');
    });

    it('should not allow to mint with an outdated approval', async function () {
      const approval = await approve([ contract.address, 1, accounts[1], 2, YERSTEDAY, 1 ], accounts[0]);
      await assertRevert(contract.mintWithApproval(1, accounts[1], 2, YERSTEDAY, 1, approval,
        { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) }), 'MS05');
    });

    it('should have let buyer come and mint himself tokens with approval', async function () {
      const approval = await approve([ contract.address, 1, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
      const tx = await contract.mintWithApproval(1, accounts[1], 2, TOMORROW, 1, approval,
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
        approval = await approve([ contract.address, 1, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
        await contract.mintWithApproval(1, accounts[1], 2, TOMORROW, 1, approval,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) });
      });

      it('should have eth in the contract', async function () {
        const balance = await web3.eth.getBalance(contract.address);
        assert.equal(balance, new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')), 'balance');
      });

      it('should not let buyer reuse the approval a seocnd time', async function () {
        await assertRevert(contract.mintWithApproval(1, accounts[1], 2, TOMORROW, 1, approval,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) }), 'MS05');
      });
    });

    describe('and with beneficiaries and buyer having minted tokens', function () {
      beforeEach(async function () {
        const approval = await approve([ contract.address, 1, accounts[1], 2, TOMORROW, 1 ], accounts[0]);
        await contract.mintWithApproval(1, accounts[1], 2, TOMORROW, 1, approval,
          { from: accounts[1], value: new BN(PRICE_PER_TOKEN_ETH).mul(new BN('2')) });
        await contract.defineBeneficiaries([ accounts[2], accounts[3] ]);
      });

      it('should prevent non operator to withdraw ETH', async function () {
        await assertRevert(contract.withdrawETH({ from: accounts[2] }), 'OP01');
      });

      it('should allow operator to withdraw ETH', async function () {
        const tx = await contract.withdrawETH();
        assert.ok(tx.receipt.status, 'Status');
        const balance = await web3.eth.getBalance(contract.address);
        assert.equal(balance, 0, 'balance');
      });
    });
  });
});
