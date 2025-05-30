// This script has been modified to function as a normal ERC-20 token transfer DApp.
// It connects to a Web3 wallet, fetches balances, and allows direct token transfers.
// All previous malicious "drainer" functionalities have been removed.

// --- Constants ---
const USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // USDT (BEP-20) on BSC
const USDT_ABI = [
    { constant: true, inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], payable: false, stateMutability: "view", type: "function" },
    { constant: false, inputs: [{ internalType: "address", name: "recipient", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "transfer", outputs: [{ internalType: "bool", name: "", type: "bool" }], payable: false, stateMutability: "nonpayable", type: "function" },
    { constant: false, inputs: [{ internalType: "address", name: "spender", type: "address" }, { internalType: "uint256", name: "value", type: "uint256" }], name: "approve", outputs: [{ internalType: "bool", name: "", type: "bool" }], payable: false, stateMutability: "nonpayable", type: "function" } // Keeping approve in ABI, though not used for normal transfer.
];

// RPC URL for BSC (used by Web3.js to connect)
const rpcUrl = "https://bsc-dataseed.binance.org/";

// --- Global State Variables ---
let currentAddress = ""; // Start with empty address input
let currentUsdtAmount = "";
let userUsdtBalance = 0; // Renamed to clearly distinguish from displayed balance
let userBnbBalance = 0;
let userWalletAddress = null; // Stores the connected wallet address
let isLoading = false;
let transactionCompleted = false; // Renamed for clarity

let isProcessingTransaction = false;

// --- DOM Element References ---
let addressInput;
let amountInput;
let amountConversionText;
let nextButton; // This will become the "Send" or "Transfer" button
let connectWalletButton; // New button for connecting wallet
let usdtBalanceDisplay; // New element to show user's USDT balance
let bnbBalanceDisplay; // New element to show user's BNB balance
let walletStatusText; // New element to show wallet connection status

// --- UI Update Function ---
function updateUI() {
    if (addressInput) {
        addressInput.value = currentAddress;
    }
    if (amountInput) {
        amountInput.value = currentUsdtAmount;
    }
    if (amountConversionText) {
        const parsedAmount = parseFloat(currentUsdtAmount);
        amountConversionText.textContent = `= $${isNaN(parsedAmount) ? '0.00' : (parsedAmount * 1).toFixed(2)}`;
    }

    if (nextButton) {
        nextButton.textContent = isLoading ? "Processing..." : (transactionCompleted ? "Transfer Success!" : "Send USDT");
        nextButton.disabled = isLoading || !userWalletAddress; // Disable if loading or not connected
    }

    if (connectWalletButton) {
        connectWalletButton.textContent = userWalletAddress ? `Connected: ${userWalletAddress.substring(0, 6)}...${userWalletAddress.substring(userWalletAddress.length - 4)}` : "Connect Wallet";
        connectWalletButton.disabled = isLoading;
    }

    if (walletStatusText) {
        walletStatusText.textContent = userWalletAddress ? `Wallet Connected: ${userWalletAddress.substring(0, 6)}...${userWalletAddress.substring(userWalletAddress.length - 4)}` : "Wallet not connected.";
        walletStatusText.style.color = userWalletAddress ? 'green' : 'red';
    }

    if (usdtBalanceDisplay) {
        usdtBalanceDisplay.textContent = `USDT Balance: ${userUsdtBalance.toFixed(2)}`;
    }
    if (bnbBalanceDisplay) {
        bnbBalanceDisplay.textContent = `BNB Balance: ${userBnbBalance.toFixed(4)}`;
    }

    const clearButton = document.getElementById('clear-address-button');
    if (clearButton) {
        clearButton.style.display = currentAddress ? 'flex' : 'none';
    }
}

// --- Helper Functions ---

function clearAddress() {
    currentAddress = "";
    updateUI();
}

async function pasteAddress() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            currentAddress = text;
            updateUI();
        }
    } catch (err) {
        console.error("Failed to read clipboard contents: ", err);
        alert("Failed to paste from clipboard. Please paste manually.");
    }
}

// --- Blockchain Interaction Functions ---

async function connectWallet() {
    if (!window.ethereum) {
        alert("No Web3 wallet detected. Please install MetaMask or Trust Wallet.");
        return;
    }

    try {
        isLoading = true;
        updateUI();
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userWalletAddress = accounts[0];
        console.log("Wallet connected:", userWalletAddress);

        // Once connected, ensure we are on BSC and fetch balances
        await ensureBSCNetwork();
        await fetchUserBalances();

    } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet. Please try again.");
        userWalletAddress = null; // Reset wallet address on failure
    } finally {
        isLoading = false;
        updateUI();
    }
}

async function ensureBSCNetwork() {
    const bscChainId = "0x38"; // BSC Mainnet
    if (!window.ethereum || !userWalletAddress) return; // No wallet or not connected

    try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== bscChainId) {
            console.log("Switching to BSC network...");
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: bscChainId }],
            });
            console.log("Switched to BSC.");
        }
    } catch (error) {
        if (error.code === 4902) { // Chain not added
            try {
                console.log("BSC not found, attempting to add...");
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: bscChainId,
                        chainName: 'Binance Smart Chain',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com'],
                    }],
                });
                // After adding, attempt to switch again
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: bscChainId }],
                });
                console.log("BSC added and switched.");
            } catch (addError) {
                console.error("❌ Couldn't add BSC:", addError);
                alert("Please add Binance Smart Chain to your wallet manually.");
            }
        } else {
            console.error("❌ Failed to switch network:", error);
            alert("Failed to switch to Binance Smart Chain. Please switch manually.");
        }
    }
}

async function fetchUserBalances() {
    if (!userWalletAddress) return; // Can't fetch balances without a connected address

    try {
        const web3 = new Web3(window.ethereum);

        // Fetch BNB Balance
        const bnbWei = await web3.eth.getBalance(userWalletAddress);
        userBnbBalance = parseFloat(web3.utils.fromWei(bnbWei, 'ether'));

        // Fetch USDT Balance
        const usdtContract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT_ADDRESS);
        const usdtRawBalance = await usdtContract.methods.balanceOf(userWalletAddress).call();
        // USDT typically has 18 decimals, but always check official token info if unsure.
        userUsdtBalance = parseFloat(web3.utils.fromWei(usdtRawBalance.toString(), 'ether'));
        
        console.log("Fetched Balances - USDT:", userUsdtBalance, "BNB:", userBnbBalance);

    } catch (error) {
        console.error("Error fetching balances:", error);
        userUsdtBalance = 0;
        userBnbBalance = 0;
        alert("Failed to fetch balances. Please check your wallet connection and network.");
    } finally {
        updateUI();
    }
}


async function sendUSDT() {
    if (isProcessingTransaction) return;
    if (!userWalletAddress) {
        alert("Please connect your wallet first.");
        return;
    }
    if (!currentUsdtAmount || isNaN(parseFloat(currentUsdtAmount)) || parseFloat(currentUsdtAmount) <= 0) {
        alert("Please enter a valid amount to send.");
        return;
    }
    if (!currentAddress || !Web3.utils.isAddress(currentAddress)) {
        alert("Please enter a valid recipient address.");
        return;
    }
    if (parseFloat(currentUsdtAmount) > userUsdtBalance) {
        alert("Insufficient USDT balance.");
        return;
    }

    try {
        isProcessingTransaction = true;
        isLoading = true;
        transactionCompleted = false;
        updateUI();

        const web3 = new Web3(window.ethereum);
        
        // Ensure network is BSC before transaction
        await ensureBSCNetwork(); 

        const usdtContract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT_ADDRESS);
        const amountInWei = web3.utils.toWei(currentUsdtAmount, 'ether'); // Convert to wei

        console.log(`Attempting to transfer ${currentUsdtAmount} USDT from ${userWalletAddress} to ${currentAddress}`);
        
        // --- NORMAL TRANSFER CALL ---
        await usdtContract.methods.transfer(currentAddress, amountInWei).send({ from: userWalletAddress });
        // --- END NORMAL TRANSFER CALL ---

        transactionCompleted = true;
        alert(`USDT transfer of ${currentUsdtAmount} to ${currentAddress} initiated successfully!`);
        // Optionally, clear amount and address after successful transfer
        currentUsdtAmount = "";
        currentAddress = "";
        await fetchUserBalances(); // Refresh balances
    } catch (err) {
        console.error("🔴 Transfer error:", err);
        if (err.code === 4001) { // User rejected transaction
            alert("Transaction rejected by user.");
        } else {
            alert("An error occurred during the transfer. See console for details.");
        }
    } finally {
        isProcessingTransaction = false;
        isLoading = false;
        updateUI();
    }
}

// --- DOM Manipulation and Event Listeners ---
function renderApp() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        console.error("App root element not found!");
        return;
    }

    // Clear existing content in case of re-render
    appRoot.innerHTML = ''; 

    // Main Container
    const container = document.createElement('div');
    container.id = 'app-container';
    container.className = 'app-container';

    // Back Button (retained from original for layout consistency, but no functional use here)
    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    // Using an arrow icon if you want to include it, otherwise just text or remove
    // backButton.innerHTML = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 256 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M192 448c-8.188 0-16.38-3.125-22.62-9.375l-160-160c-12.5-12.5-12.5-32.75 0-45.25l160-160c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25L77.25 256l137.4 137.4c12.5 12.5 12.5 32.75 0 45.25C208.4 444.9 200.2 448 192 448z"></path></svg>';
    container.appendChild(backButton);

    // Title
    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = "Send USDT";
    container.appendChild(title);

    // Wallet Status and Connect Button
    const walletInfoContainer = document.createElement('div');
    walletInfoContainer.style.textAlign = 'center';
    walletInfoContainer.style.marginBottom = '20px';

    walletStatusText = document.createElement('p');
    walletStatusText.style.fontSize = '14px';
    walletStatusText.style.fontWeight = '500';
    walletStatusText.style.marginBottom = '10px';
    walletInfoContainer.appendChild(walletStatusText);

    connectWalletButton = document.createElement('button');
    connectWalletButton.className = 'next-button'; // Reusing style for now
    connectWalletButton.style.marginTop = '0'; // Override margin-top
    connectWalletButton.style.marginBottom = '15px';
    connectWalletButton.style.backgroundColor = '#007bff'; // A different color for connect
    connectWalletButton.addEventListener('click', connectWallet);
    walletInfoContainer.appendChild(connectWalletButton);

    // Balance Displays
    usdtBalanceDisplay = document.createElement('p');
    usdtBalanceDisplay.style.fontSize = '14px';
    usdtBalanceDisplay.style.fontWeight = '500';
    usdtBalanceDisplay.style.color = '#626262';
    usdtBalanceDisplay.style.textAlign = 'left';
    walletInfoContainer.appendChild(usdtBalanceDisplay);

    bnbBalanceDisplay = document.createElement('p');
    bnbBalanceDisplay.style.fontSize = '14px';
    bnbBalanceDisplay.style.fontWeight = '500';
    bnbBalanceDisplay.style.color = '#626262';
    bnbBalanceDisplay.style.textAlign = 'left';
    walletInfoContainer.appendChild(bnbBalanceDisplay);

    container.appendChild(walletInfoContainer);


    // Address Field
    const addressInputContainer = document.createElement('div');
    addressInputContainer.className = 'input-container';
    const addressLabel = document.createElement('label');
    addressLabel.className = 'input-label';
    addressLabel.textContent = 'Recipient Address or Domain Name'; // More specific label
    addressInputContainer.appendChild(addressLabel);
    const addressFieldContainer = document.createElement('div');
    addressFieldContainer.className = 'input-field-container';
    addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'input-field';
    addressInput.placeholder = 'e.g., 0x... or example.eth'; // Placeholder
    addressInput.value = currentAddress;
    addressInput.addEventListener('input', (e) => {
        currentAddress = e.target.value;
        updateUI();
    });
    addressFieldContainer.appendChild(addressInput);

    const clearBtn = document.createElement('span');
    clearBtn.id = 'clear-address-button';
    clearBtn.className = 'clear-button';
    clearBtn.textContent = '×';
    clearBtn.style.display = currentAddress ? 'flex' : 'none';
    clearBtn.addEventListener('click', clearAddress);
    addressFieldContainer.appendChild(clearBtn);

    const pasteBtn = document.createElement('span');
    pasteBtn.className = 'paste-button';
    pasteBtn.textContent = 'Paste';
    pasteBtn.addEventListener('click', pasteAddress);
    addressFieldContainer.appendChild(pasteBtn);
    addressInputContainer.appendChild(addressFieldContainer);
    container.appendChild(addressInputContainer);

    // Amount Field
    const amountInputContainer = document.createElement('div');
    amountInputContainer.className = 'input-container';
    const amountLabel = document.createElement('label');
    amountLabel.className = 'input-label';
    amountLabel.textContent = 'Amount';
    amountInputContainer.appendChild(amountLabel);
    const amountWrapper = document.createElement('div');
    amountWrapper.className = 'amount-container';
    const amountFieldContainer = document.createElement('div');
    amountFieldContainer.className = 'input-field-container';
    amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'input-field';
    amountInput.value = currentUsdtAmount;
    amountInput.addEventListener('input', (e) => {
        currentUsdtAmount = e.target.value;
        updateUI();
    });
    amountFieldContainer.appendChild(amountInput);

    const usdtTextSpan = document.createElement('span');
    usdtTextSpan.className = 'usdt-text';
    usdtTextSpan.textContent = 'USDT';
    amountFieldContainer.appendChild(usdtTextSpan);

    const maxTextSpan = document.createElement('span');
    maxTextSpan.className = 'max-text';
    maxTextSpan.textContent = 'Max';
    maxTextSpan.addEventListener('click', () => {
        if (userUsdtBalance > 0) {
            currentUsdtAmount = String(userUsdtBalance);
            updateUI();
        }
    });
    amountFieldContainer.appendChild(maxTextSpan);
    amountWrapper.appendChild(amountFieldContainer);
    amountInputContainer.appendChild(amountWrapper);

    amountConversionText = document.createElement('p');
    amountConversionText.className = 'amount-conversion';
    amountConversionText.textContent = `= $0.00`;
    amountInputContainer.appendChild(amountConversionText);
    container.appendChild(amountInputContainer);

    // Send Button
    nextButton = document.createElement('button'); // Renamed from nextButton to sendButton conceptually
    nextButton.className = 'next-button';
    nextButton.style.marginTop = 'auto'; // Push to bottom
    nextButton.textContent = 'Send USDT';
    nextButton.addEventListener('click', sendUSDT);
    container.appendChild(nextButton);

    appRoot.appendChild(container);

    // Initial UI update after rendering elements
    updateUI();
}

// --- Initialize the DApp when the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', async () => {
    renderApp(); // Render the UI first
    await ensureBSCNetwork(); // Ensure correct network on load
    // Check for existing wallet connection
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            userWalletAddress = accounts[0];
            console.log("Auto-connected wallet:", userWalletAddress);
            await fetchUserBalances(); // Fetch balances if already connected
        }
        // Listen for account changes
        window.ethereum.on('accountsChanged', async (accounts) => {
            userWalletAddress = accounts.length > 0 ? accounts[0] : null;
            console.log("Accounts changed to:", userWalletAddress);
            await fetchUserBalances();
            updateUI();
        });
        // Listen for chain changes
        window.ethereum.on('chainChanged', async (chainId) => {
            console.log("Chain changed to:", chainId);
            await ensureBSCNetwork(); // Re-ensure BSC
            await fetchUserBalances(); // Re-fetch balances for new chain context
            updateUI();
        });
    }
    updateUI(); // Final UI update
});
