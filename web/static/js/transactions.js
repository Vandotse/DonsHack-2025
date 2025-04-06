// Transactions array (will be populated from API)
let transactions = [];

// Load transactions from API
async function loadTransactions() {
  try {
    // Use fetchAPI from main.js
    const response = await fetchAPI('/api/transactions');
    
    // Update transactions array
    transactions = response.transactions || [];
    
    // Display transactions
    displayTransactions();
    
    return transactions;
  } catch (error) {
    console.error('Failed to load transactions:', error);
    showMessage('Failed to load transactions', 'error');
    
    // If unauthorized, logout
    if (error.message.includes('Unauthorized')) {
      logoutUser();
    }
    
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load transactions if we're on a page that displays them
  if (document.getElementById('transaction-list')) {
    loadTransactions();
  }
});

function displayTransactions() {
  const transactionList = document.getElementById('transaction-list');
  if (!transactionList) return;
  
  transactionList.innerHTML = ''; 
  
  // Show "No transactions" message if no transactions
  if (!transactions || transactions.length === 0) {
    transactionList.innerHTML = '<div class="empty-state">No transactions yet</div>';
    return;
  }
  
  // Use all transactions on the transactions page
  const isTransactionsPage = window.location.href.includes('transactions.html');
  const transactionsToDisplay = isTransactionsPage ? transactions : transactions.slice(0, 5);
  
  transactionsToDisplay.forEach(transaction => {
    const transactionItem = createTransactionItem(transaction);
    transactionList.appendChild(transactionItem);
  });
}

function createTransactionItem(transaction) {
  const transactionItem = document.createElement('div');
  transactionItem.className = 'transaction-item';
  
  const transactionDate = new Date(transaction.transaction_date);
  const formattedDate = transactionDate.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
  const formattedTime = transactionDate.toLocaleTimeString(undefined, { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  transactionItem.innerHTML = `
    <div class="transaction-info">
      <div class="transaction-icon">
        <i class="fas ${transaction.icon}"></i>
      </div>
      <div class="transaction-details">
        <h4>${transaction.location}</h4>
        <p>${formattedDate} at ${formattedTime}</p>
      </div>
    </div>
    <div class="transaction-amount">-$${transaction.amount.toFixed(2)}</div>
  `;
  
  return transactionItem;
}

function getIconForTransaction(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('cafe') || lowerName.includes('restaurant') || lowerName.includes('dining')) {
    return 'fa-utensils';
  } else if (lowerName.includes('book') || lowerName.includes('library')) {
    return 'fa-book';
  } else if (lowerName.includes('coffee')) {
    return 'fa-coffee';
  } else if (lowerName.includes('center')) {
    return 'fa-mug-hot';
  } else if (lowerName.includes('truck') || lowerName.includes('food truck')) {
    return 'fa-truck';
  } else {
    return 'fa-receipt';
  }
}

async function addNewTransaction(location, amount, description = '') {
  try {
    // Check if this transaction will exceed the weekly budget
    const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    const strictBudget = settings.strictBudget !== undefined ? settings.strictBudget : false;
    const amountNum = parseFloat(amount);
    
    // If strict budget is enabled and this transaction would exceed the weekly budget
    if (strictBudget && userData.currentWeekSpent + amountNum > userData.weeklyBudget) {
      // User must confirm the transaction
      const isConfirmed = confirm(
        `Warning: This transaction will exceed your weekly budget of $${userData.weeklyBudget.toFixed(2)}.\n\n` +
        `Current weekly spending: $${userData.currentWeekSpent.toFixed(2)}\n` +
        `New transaction: $${amountNum.toFixed(2)}\n` +
        `Total after transaction: $${(userData.currentWeekSpent + amountNum).toFixed(2)}\n\n` +
        `Do you want to proceed with this transaction?`
      );
      
      if (!isConfirmed) {
        throw new Error('Transaction cancelled');
      }
    }
    
    // Create transaction through API
    const newTransaction = await fetchAPI('/api/transactions/new', {
      method: 'POST',
      body: JSON.stringify({
        location,
        amount: amountNum,
        description
      })
    });
    
    // Refresh user data and transactions
    await loadUserData();
    await loadTransactions();
    
    // Show success message
    showMessage('Transaction added successfully');
    
    return newTransaction;
  } catch (error) {
    console.error('Failed to add transaction:', error);
    
    // Don't show error for user cancellation
    if (error.message !== 'Transaction cancelled') {
      showMessage('Failed to add transaction: ' + error.message, 'error');
    }
    
    throw error;
  }
}

function showAddTransactionForm() {
  // Check if form already exists to prevent duplicates
  if (document.querySelector('.add-transaction-form')) {
    return;
  }

  const form = document.createElement('div');
  form.className = 'add-transaction-form';
  form.innerHTML = `
    <div class="form-overlay"></div>
    <div class="form-container">
      <h3>Add New Transaction</h3>
      <div class="form-group">
        <label for="transaction-name">Location</label>
        <input type="text" id="transaction-name" placeholder="Where did you spend?">
      </div>
      <div class="form-group">
        <label for="transaction-amount">Amount ($)</label>
        <input type="number" id="transaction-amount" step="0.01" min="0.01" placeholder="How much did you spend?">
      </div>
      <div class="form-group">
        <label for="transaction-description">Description (Optional)</label>
        <input type="text" id="transaction-description" placeholder="Description of the transaction">
      </div>
      <div class="form-actions">
        <button id="cancel-transaction" class="btn-secondary">Cancel</button>
        <button id="save-transaction" class="btn-primary">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(form);
  
  const formStyle = document.createElement('style');
  formStyle.textContent = `
    .add-transaction-form {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .form-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }
    .form-container {
      position: relative;
      background-color: white;
      padding: 2rem;
      border-radius: 10px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    .form-group input {
      width: 100%;
      padding: 0.8rem;
      border: 1px solid var(--border-color);
      border-radius: 5px;
      font-size: 1rem;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
    }
    .btn-primary {
      background-color: var(--primary-color);
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-primary:hover {
      background-color: var(--secondary-color);
      color: #000;
    }
    .btn-secondary {
      background-color: #f1f1f1;
      color: #333;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-secondary:hover {
      background-color: #e0e0e0;
    }
    
    /* Toast messages */
    .toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background-color: #4CAF50;
      color: white;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 1001;
    }
    .toast-error {
      background-color: #F44336;
    }
    .toast-visible {
      opacity: 1;
    }
    
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #888;
      font-style: italic;
    }
  `;
  
  document.head.appendChild(formStyle);
  
  // Focus on the name input
  setTimeout(() => {
    document.getElementById('transaction-name').focus();
  }, 100);
  
  const closeForm = () => {
    const form = document.querySelector('.add-transaction-form');
    if (form) {
      form.remove();
    }
  };
  
  // Handle save transaction
  document.getElementById('save-transaction').addEventListener('click', async () => {
    const name = document.getElementById('transaction-name').value;
    const amount = document.getElementById('transaction-amount').value;
    const description = document.getElementById('transaction-description')?.value || '';
    
    if (!name || !amount) {
      showMessage('Please enter both location and amount', 'error');
      return;
    }
    
    if (parseFloat(amount) <= 0) {
      showMessage('Amount must be positive', 'error');
      return;
    }
    
    // Disable the save button
    const saveButton = document.getElementById('save-transaction');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    
    try {
      await addNewTransaction(name, amount, description);
      closeForm();
    } catch (error) {
      // Error is already handled in addNewTransaction function
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });
  
  // Handle cancel button
  document.getElementById('cancel-transaction').addEventListener('click', () => {
    closeForm();
  });
  
  // Handle overlay click
  document.querySelector('.form-overlay').addEventListener('click', (e) => {
    if (e.target === document.querySelector('.form-overlay')) {
      closeForm();
    }
  });
  
  // Handle keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeForm();
    }
    
    if (e.key === 'Enter' && document.activeElement.id === 'transaction-amount') {
      document.getElementById('save-transaction').click();
    }
  });
} 