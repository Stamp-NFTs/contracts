const fs = require('fs');
const path = require('path');

require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-solhint');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('hardhat-tracer');

let secret = {};
try {
  // Secret file format is:
  // { mnemonic: '', projectId, '', endpoints: { <networkname>: 'http://endpoint' } }

  const secretFiles = [ '~/.secret.json', '../.secret.json', '../../.secret.json', '../../../.secret.json' ];
  for (let i = 0; i < secretFiles.length; i++) {
    if (fs.existsSync(secretFiles[i])) {
      secret = JSON.parse(fs.readFileSync(secretFiles[i]));
      break;
    }
  }

  const secretFile = path.join(__dirname, '.secret.json');
  if (fs.existsSync(secretFile)) {
    secret = JSON.parse(fs.readFileSync(secretFile));
  }
} catch (warning) {
  console.warn('Unable to find secret configuration:', warning);
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + secret.projectId,
      chainId: 4,
      gas: 'auto',
      accounts: {
        mnemonic: secret.mnemonic,
      },
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/' + secret.projectId,
      chainId: 5,
      gas: 'auto',
      accounts: {
        mnemonic: secret.mnemonic,
      },
    },
  },
};
