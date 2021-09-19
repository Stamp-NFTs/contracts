require('@nomiclabs/hardhat-truffle5');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
/*task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.web3.eth.getAccounts().then(async (accounts) =>
    await Promise.all(accounts.map(async (account) => {
      const balance = await hre.web3.eth.getBalance(account);
      return {
        address: account,
        balance: await hre.web3.eth.getBalance(account)
      };
    }))
  );

  for (const account of accounts) {
    console.log(account.address + ' : ' + hre.web3.utils.fromWei(account.balance, 'ether') + ' ETH');
  }
});*/

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  }
};
