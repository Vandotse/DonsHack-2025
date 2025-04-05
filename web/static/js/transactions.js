document.addEventListener('DOMContentLoaded', () => {
  displayTransactions();
});

function displayTransactions() {
  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = ''; 
  
  const recentTransactions = transactions.slice(0, 5);
  
  recentTransactions.forEach(transaction => {
    const transactionItem = document.createElement('div');
    transactionItem.className = 'transaction-item';
    
    const transactionDate = new Date(transaction.date);
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
          <h4>${transaction.name}</h4>
          <p>${formattedDate} at ${formattedTime}</p>
        </div>
      </div>
      <div class="transaction-amount">-$${transaction.amount.toFixed(2)}</div>
    `;
    
    transactionList.appendChild(transactionItem);
  });
}

function addNewTransaction(name, amount, icon = 'fa-shopping-bag') {
  const newTransaction = {
    id: transactions.length + 1,
    name: name,
    amount: parseFloat(amount),
    date: new Date().toISOString(),
    icon: icon
  };
  
  transactions.unshift(newTransaction);
  
  displayTransactions();
  
  updateBalanceAndBudget(newTransaction.amount);
}

function updateBalanceAndBudget(amount) {
  userData.currentBalance -= amount;
  userData.spent += amount;
  userData.currentWeekSpent += amount;
  userData.budgetPercentage = Math.round((userData.currentWeekSpent / userData.weeklyBudget) * 100);
  
  document.getElementById('current-balance').textContent = userData.currentBalance.toFixed(2);
  document.getElementById('spent-amount').textContent = userData.spent.toFixed(2);
  document.getElementById('current-week-spent').textContent = userData.currentWeekSpent.toFixed(2);
  document.getElementById('budget-percentage').textContent = userData.budgetPercentage + '%';
  document.getElementById('budget-progress').style.width = userData.budgetPercentage + '%';
  
  const progressBar = document.getElementById('budget-progress');
  if (userData.budgetPercentage < 50) {
    progressBar.style.backgroundColor = 'var(--success-color)';
  } else if (userData.budgetPercentage < 80) {
    progressBar.style.backgroundColor = 'var(--warning-color)';
  } else {
    progressBar.style.backgroundColor = 'var(--danger-color)';
  }
  
  checkSpendingLimit();
}

function showAddTransactionForm() {
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
    }
    .btn-primary, .btn-secondary {
      padding: 0.8rem 1.5rem;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-primary {
      background-color: var(--primary-color);
      color: white;
    }
    .btn-secondary {
      background-color: #f5f5f5;
      color: var(--text-color);
    }
  `;
  document.head.appendChild(formStyle);
  
  document.getElementById('cancel-transaction').addEventListener('click', () => {
    form.remove();
    formStyle.remove();
  });
  
  document.getElementById('save-transaction').addEventListener('click', () => {
    const name = document.getElementById('transaction-name').value;
    const amount = document.getElementById('transaction-amount').value;
    
    if (name && amount && parseFloat(amount) > 0) {
      const newAmount = parseFloat(amount);
      const newTotalSpent = userData.currentWeekSpent + newAmount;
      const newPercentage = Math.round((newTotalSpent / userData.weeklyBudget) * 100);
      
      if (newPercentage >= 100) {
        if (confirm(`This purchase will put you over your weekly budget. Are you sure you want to proceed?`)) {
          addNewTransaction(name, amount);
          form.remove();
          formStyle.remove();
        }
      } else {
        addNewTransaction(name, amount);
        form.remove();
        formStyle.remove();
      }
    } else {
      alert('Please enter valid transaction details');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addButton = document.createElement('button');
  addButton.className = 'add-transaction-button';
  addButton.innerHTML = '<i class="fas fa-plus"></i>';
  
  addButton.style.position = 'fixed';
  addButton.style.bottom = '30px';
  addButton.style.right = '30px';
  addButton.style.width = '60px';
  addButton.style.height = '60px';
  addButton.style.borderRadius = '50%';
  addButton.style.backgroundColor = 'var(--primary-color)';
  addButton.style.color = 'white';
  addButton.style.border = 'none';
  addButton.style.fontSize = '1.5rem';
  addButton.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
  addButton.style.cursor = 'pointer';
  addButton.style.display = 'flex';
  addButton.style.alignItems = 'center';
  addButton.style.justifyContent = 'center';
  addButton.style.zIndex = '900';
  
  addButton.addEventListener('mouseenter', () => {
    addButton.style.backgroundColor = '#FDBB30'; 
    addButton.style.color = '#000'; 
  });
  
  addButton.addEventListener('mouseleave', () => {
    addButton.style.backgroundColor = 'var(--primary-color)';
    addButton.style.color = 'white';
  });
  
  addButton.addEventListener('click', showAddTransactionForm);
  
  document.body.appendChild(addButton);
}); 