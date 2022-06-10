const isLive = false;

window.addEventListener('DOMContentLoaded', async () => {
  let accounts;
  const onboarding = new MetaMaskOnboarding();
  const mintReserve = document.getElementById('mintReserve');
  const mintPublic = document.getElementById('mintButton');

  // Offer to install MetaMask if it's not installed nor do we
  // detect a replacement such as Coinbase wallet
  if (!MetaMaskOnboarding.isMetaMaskInstalled() && !window.ethereum) {
    alert('This site requires a browser wallet addon, such as Coinbase wallet or MetaMask. Redirecting you to a page to download MetaMask.');
    onboarding.startOnboarding();
  } else if (accounts && accounts.length > 0) {
    onboarding.stopOnboarding();
  }
  await switchNetwork();
  await getMMAccount();
  await updateMintStatus();
  let _i = setInterval(updateMintStatus, 10000);

  mintReserve.onclick = async () => {
    clearInterval(_i);
    await _mintReserve();
  };

  mintPublic.onclick = async () => {
    clearInterval(_i);
    await _mintPublic();
  };

  ethereum.on('accountsChanged', function (accounts) {
    window.location.href = '';
  })
});

async function _mintReserve() {
  try {
    await mintReserve();
  } catch(e) {
    // console.log(e)
    if (e.message) {
      alert(e.message);
    } else {
      alert(e.toString());
    }
    await updateMintStatus();
    return false;
  }
}

async function _mintPublic() {
  try {
    await mintPublic();
  } catch(e) {
    // console.log(e)
    if (e.message) {
      alert(e.message);
    } else {
      alert(e.toString());
    }
    await updateMintStatus();
    return false;
  }
}

async function getMMAccount() {
  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    const account = accounts[0];
    return account;
  } catch(e) {
    updateMintMessage(`Something went wrong. Refresh and try again.`);
  }
}

function updateMintMessage(reason) {
  document.getElementById('mintMessage').innerHTML = reason;
}

async function getDistribution() {
  let distr;
  let account = await getMMAccount();
  return await fetch('/distribution.json', {cache: 'no-cache'})
    .then((res) => res.json())
    .then(data => {
      for(addr in data) {
        if (addr.toLowerCase() == account.toLowerCase()) {
          distr = data[addr];
          console.log(`Found details for address ${addr}: ${JSON.stringify(distr)}`);
        }
      }
      return distr;
    });
}

async function switchNetwork(){
  // don't do this if no metamask (errors on coinbase wallet)
  if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
    return false;
  }
  let chainId;
  if (!isLive) {
    chainId = '0x4';
  } else {
    chainId = '0x1';
  }
  await ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainId }],
  });
}

async function updateMintStatus() {
  const w3 = new Web3(Web3.givenProvider || "http://127.0.0.1:7545");
  const walletAddress = await getMMAccount();
  const walletShort = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
  const contract = new w3.eth.Contract(contractABI, contractAddress, {from: walletAddress});
  const currentSupply = await contract.methods.totalSupply().call();
  const maxSupply = await contract.methods.maxSupply().call();
  const maxMints = await contract.methods.maxMint().call();
  const merkleSet = await contract.methods.merkleSet().call();
  const reserveMinted = await contract.methods.reserveMinted().call();
  const publicMinted = await contract.methods.publicMinted().call();
  const reservedSupply = await contract.methods.reservedSupply().call();
  const balance = await contract.methods.balanceOf(walletAddress).call();
  const publicBalance = await contract.methods.publicBalance(walletAddress).call();
  const reserveBalance = await contract.methods.reserveBalance(walletAddress).call();
  const mintingIsActive = await contract.methods.mintingIsActive().call();
  const mintedOut = currentSupply == maxSupply;
  const dist = await getDistribution();
  if (mintedOut) {
    updateMintMessage(`That's all folks, supply is minted out! Check secondary markets to purchase an RMutt urinal.<br><br><a href="https://opensea.io/collection/rmutt" target=_blank>Opensea</a>`);
    return false;
  }
  if (!mintingIsActive) {
    if (dist && merkleSet) {
      let remaining = dist.Amount - reserveBalance;
      if (remaining < 0) {
        remaining = 0;
      }
      updateMintMessage(`Minting is not active yet! Check back later.<br><br>Wallet ${walletShort} is whitelisted for ${dist.Amount} toilets. ${remaining} remaining.<div style="margin-top: 8px"></div><h2><b>${reserveMinted} / ${reservedSupply} reserves minted.<br/>${publicMinted} / ${maxSupply - reservedSupply} public minted.</b></h2><div style="margin-top: 8px"></div>`);
      return false;
    } else {
      updateMintMessage(`Minting is not active yet! Check back later.<br><br>Wallet ${walletShort} is not whitelisted for any toilets.</br><div style="margin-top: 8px"></div><h2><b>${reserveMinted} / ${reservedSupply} reserves minted.<br/>${publicMinted} / ${maxSupply - reservedSupply} public minted.</b></h2><div style="margin-top: 8px"></div>`);
      return false;
    }
  }
  if (dist) {
    let remaining = dist.Amount - reserveBalance;
    if (remaining < 0) {
      remaining = 0;
    }
    updateMintMessage(`Wallet ${walletShort} is whitelisted for ${remaining} more toilets (${dist.Amount} whitelisted, ${reserveBalance} minted). </br>Minted ${publicBalance} / ${maxMints} public. <br/><div style="margin-top: 8px"></div><h2><b>${reserveMinted} / ${reservedSupply} reserves minted.<br/>${publicMinted} / ${maxSupply - reservedSupply} public minted.</b></h2><div style="margin-top: 8px"></div>`);
    if (remaining == 0) {
      document.getElementById('mintForm').classList.remove('hidden');
      document.getElementById('mintButton').classList.remove('hidden');
      return false;
    }
    document.getElementById('numberOfTokens').max = 50;
    document.getElementById('numberOfTokens').value = remaining;
    document.getElementById('mintForm').classList.remove('hidden');
    document.getElementById('mintButton').classList.remove('hidden');
    document.getElementById('mintReserve').classList.remove('hidden');
  } else {
    updateMintMessage(`Public minting is live! Limit ${maxMints} per transaction. Max ${maxMints} per wallet. You have ${publicBalance} public mints and ${balance} total in your wallet.</br><div style="margin-top: 8px"></div><h2><b>${reserveMinted} / ${reservedSupply} reserves minted.<br/>${publicMinted} / ${maxSupply - reservedSupply} public minted.</b></h2><div style="margin-top: 8px"></div>`);
    document.getElementById('mintForm').classList.remove('hidden');
    document.getElementById('mintButton').classList.remove('hidden');
  }
}

async function mintReserve() {
  let etherscan_uri = 'etherscan.io';
  let opensea_uri = 'opensea.io';
  // First do nothing if MetaMask is on Mainnet and we're not live yet
  if (!isLive) {
    if (window.ethereum.chainId == "0x1") {
      updateMintMessage(`Mainnet contracts not available yet. Try again later.`);
      return false;
    }
    etherscan_uri = 'rinkeby.etherscan.io';
    opensea_uri = 'testnets.opensea.io';
  }

  let res;
  let loadModal;
  let gasLimit;
  const w3 = new Web3(Web3.givenProvider || "http://127.0.0.1:7545");
  const walletAddress = await getMMAccount();
  const gasPrice = await w3.eth.getGasPrice();
  let amountToMint = document.getElementById('numberOfTokens').value;
  if (amountToMint <= 0 || isNaN(amountToMint)) {
    amountToMint = 1;
    document.getElementById('numberOfTokens').value = amountToMint;
  }

  document.getElementById('mintButton').classList.add('hidden');
  document.getElementById('mintReserve').classList.add('hidden');

  // Define the contract we want to use
  const contract = new w3.eth.Contract(contractABI, contractAddress, {from: walletAddress});

  // Fail if sales are paused
  const mintingIsActive = await contract.methods.mintingIsActive().call();
  if (!mintingIsActive) {
    updateMintMessage(`Sales are currently paused on this contract. Try again later.`);
    return false;
  }

  // Fail if requested amount would exceed supply
  let currentSupply = await contract.methods.totalSupply().call();
  let maxSupply = await contract.methods.maxSupply().call();
  if (Number(currentSupply) + Number(amountToMint) > Number(maxSupply)) {
    updateMintMessage(`Requesting ${amountToMint} would exceed the maximum token supply of ${maxSupply}. Current supply is ${currentSupply}, so try minting ${maxSupply - currentSupply}.`)
    return false;
  }

  // Get the merkle tree distribution info for the user
  const dist = await getDistribution();

  if (dist) {

    // Fail if the merkle root hash is not set
    const merkleSet = await contract.methods.merkleSet().call();
    if (!merkleSet) {
      updateMintMessage(`Admin has not setup the contract properly yet: No merkle root hash is set`);
      return false;
    }

    // Fail if the amountToMint is more than allowed
    const balance = await contract.methods.reserveBalance(walletAddress).call();
    if (Number(Number(amountToMint) + Number(balance)) > Number(dist.Amount)) {
      updateMintMessage(`Cannot mint more than your whitelisted amount of ${dist.Amount}. You already have ${balance}.`);
      return false;
    }

    // Estimate gas limit
    await contract.methods.mintReserve(dist.Index, walletAddress, Number(dist.Amount), dist.Proof, amountToMint).estimateGas({from: walletAddress}, function(err, gas){
      gasLimit = gas;
    });

    // Show loading icon
    document.getElementById('mintForm').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');
    updateMintMessage('');

    // Attempt minting
    console.log(`Attempting to mint ${amountToMint} tokens with gas limit of ${gasLimit} gas and gas price of ${gasPrice}`);
    res = await contract.methods.mintReserve(dist.Index, walletAddress, Number(dist.Amount), dist.Proof, amountToMint).send({
      from: walletAddress,
      value: 0,
      gasPrice: gasPrice,
      gas: gasLimit
    });
    console.log(res);
  } else {
    alert('Wallet not whitelisted. Mint from the public supply.');
    return false;
  }

  document.getElementById('mintForm').classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');

  if (res.status) {
    updateMintMessage(`Success! Head to <a href="https://${opensea_uri}/account?search[resultModel]=ASSETS&search[sortBy]=LAST_TRANSFER_DATE&search[sortAscending]=false">OpenSea</a> to see your NFTs!`);
    document.getElementById('mintForm').innerHTML = `<a href="https://${etherscan_uri}/tx/${res.transactionHash}">Etherscan</a>`;
  } else {
    updateMintMessage('FAILED!');
    document.getElementById('mintForm').innerHTML = `<a href="">Try Again</a>`;
  }
}

async function mintPublic() {
  let etherscan_uri = 'etherscan.io';
  let opensea_uri = 'opensea.io';
  // First do nothing if MetaMask is on Mainnet and we're not live yet
  if (!isLive) {
    if (window.ethereum.chainId == "0x1") {
      updateMintMessage(`Mainnet contracts not available yet. Try again later.`);
      return false;
    }
    etherscan_uri = 'rinkeby.etherscan.io';
    opensea_uri = 'testnets.opensea.io';
  }

  let res;
  let loadModal;
  let gasLimit;
  const w3 = new Web3(Web3.givenProvider || "http://127.0.0.1:7545");
  const walletAddress = await getMMAccount();
  const gasPrice = await w3.eth.getGasPrice();
  let amountToMint = document.getElementById('numberOfTokens').value;
  if (amountToMint <= 0 || isNaN(amountToMint)) {
    amountToMint = 1;
    document.getElementById('numberOfTokens').value = amountToMint;
  }

  document.getElementById('mintButton').classList.add('hidden');
  document.getElementById('mintReserve').classList.add('hidden');

  // Define the contract we want to use
  const contract = new w3.eth.Contract(contractABI, contractAddress, {from: walletAddress});

  // Fail if sales are paused
  const mintingIsActive = await contract.methods.mintingIsActive().call();
  if (!mintingIsActive) {
    updateMintMessage(`Sales are currently paused on this contract. Try again later.`);
    return false;
  }

  // Fail if requested amount would exceed supply
  let currentSupply = await contract.methods.totalSupply().call();
  let maxSupply = await contract.methods.maxSupply().call();
  if (Number(currentSupply) + Number(amountToMint) > Number(maxSupply)) {
    updateMintMessage(`Requesting ${amountToMint} would exceed the maximum token supply of ${maxSupply}. Current supply is ${currentSupply}, so try minting ${maxSupply - currentSupply}.`)
    return false;
  }

  // Fail if requested amount would exceed max per wallet
  let publicBalance = await contract.methods.publicBalance(walletAddress).call();
  let maxWallet = await contract.methods.maxWallet().call();
  if (Number(amountToMint) + Number(publicBalance) > Number(maxWallet)) {
    updateMintMessage(`Requesting ${amountToMint} would exceed the maximum wallet amount of ${maxWallet}. Current balance is ${publicBalance}, so try minting ${maxWallet - publicBalance}.`)
    return false;
  }

  // Estimate gas limit
  await contract.methods.mintPublic(amountToMint).estimateGas({from: walletAddress}, function(err, gas){
    gasLimit = gas;
  });

  // Show loading icon
  document.getElementById('mintForm').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  updateMintMessage('');

  console.log(`Attempting to mint ${amountToMint}`);
  res = await contract.methods.mintPublic(amountToMint).send({
    from: walletAddress,
    gasPrice: gasPrice,
    gas: gasLimit
  });
  console.log(res);

  document.getElementById('mintForm').classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');

  if (res.status) {
    updateMintMessage(`Success! Head to <a href="https://${opensea_uri}/account?search[resultModel]=ASSETS&search[sortBy]=LAST_TRANSFER_DATE&search[sortAscending]=false">OpenSea</a> to see your NFTs!`);
    document.getElementById('mintForm').innerHTML = `<a href="https://${etherscan_uri}/tx/${res.transactionHash}">Etherscan</a>`;
  } else {
    updateMintMessage('FAILED!');
    document.getElementById('mintForm').innerHTML = `<a href="">Try Again</a>`;
  }
}
