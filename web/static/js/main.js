async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');
  
  console.log('Auth token from localStorage:', token ? 'Present (length: ' + token.length + ')' : 'Not found');
  
  if (!token && !endpoint.includes('/login') && !endpoint.includes('/register')) {
    console.error('No auth token available for protected endpoint:', endpoint);
    window.location.href = 'login.html';
    throw new Error('Authentication required');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('Authorization header set with token');
  }
  
  try {
    console.log(`Fetching ${endpoint}...`);
    const response = await fetch(endpoint, {
      ...options,
      headers
    });
    
    console.log(`${endpoint} response status:`, response.status);
    
    if (response.status === 401) {
      console.error('Authentication failed (401) for endpoint:', endpoint);
      
      if (!window.location.href.includes('login.html')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('studentId');
        
        window.location.href = 'login.html?error=session_expired';
      }
      
      throw new Error('Authentication failed');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`API error (${endpoint}):`, data.error);
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

let userData = {
  username: localStorage.getItem('userName') || "Student",
  startingBalance: 0,
  currentBalance: 0,
  spent: 0,
  weeklyBudget: 0,
  currentWeekSpent: 0,
  budgetPercentage: 0
};

async function loadUserData() {
  try {
    const balance = await fetchAPI('/api/users/me/balance');
    
    const budget = await fetchAPI('/api/budget');
    
    userData = {
      username: localStorage.getItem('userName') || "Student",
      startingBalance: balance.starting_balance,
      currentBalance: balance.current_balance,
      spent: balance.spent_amount,
      weeklyBudget: budget.weekly_budget,
      
      currentWeekSpent: balance.spent_amount,
        
      budgetPercentage: Math.round((balance.spent_amount / budget.weekly_budget) * 100)
    };
    
    updateUI();
  } catch (error) {
    console.error('Failed to load user data:', error);
    
    if (error.message.includes('Unauthorized')) {
      logoutUser();
    }
  }
}

function updateUI() {
  document.getElementById('username').textContent = userData.username;
  
  const currentBalanceEl = document.getElementById('current-balance');
  const startingBalanceEl = document.getElementById('starting-balance');
  const spentAmountEl = document.getElementById('spent-amount');
  const weeklyBudgetEl = document.getElementById('weekly-budget');
  const currentWeekSpentEl = document.getElementById('current-week-spent');
  const budgetPercentageEl = document.getElementById('budget-percentage');
  const budgetProgressEl = document.getElementById('budget-progress');
  
  if (currentBalanceEl) currentBalanceEl.textContent = userData.currentBalance.toFixed(2);
  if (startingBalanceEl) startingBalanceEl.textContent = userData.startingBalance.toFixed(2);
  if (spentAmountEl) spentAmountEl.textContent = userData.spent.toFixed(2);
  if (weeklyBudgetEl) weeklyBudgetEl.textContent = userData.weeklyBudget.toFixed(2);
  if (currentWeekSpentEl) currentWeekSpentEl.textContent = userData.currentWeekSpent.toFixed(2);
  
  if (budgetPercentageEl) budgetPercentageEl.textContent = userData.budgetPercentage + '%';
  
  if (budgetProgressEl) budgetProgressEl.style.width = Math.min(userData.budgetPercentage, 100) + '%';
  
  const progressBar = document.getElementById('budget-progress');
  if (progressBar) {
    if (userData.budgetPercentage < 50) {
      progressBar.style.backgroundColor = 'var(--success-color)';
    } else if (userData.budgetPercentage < 80) {
      progressBar.style.backgroundColor = 'var(--warning-color)';
    } else {
      progressBar.style.backgroundColor = 'var(--danger-color)';
    }
  }
  
  if (userData.budgetPercentage > 0) {
    checkSpendingLimit();
  }
}

async function refreshData() {
  try {
    await loadUserData();
    if (typeof loadTransactions === 'function') {
      await loadTransactions();
    }
    
    showMessage('Data refreshed successfully');
  } catch (error) {
    showMessage('Failed to refresh data', 'error');
  }
}

function showMessage(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-visible');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

function checkSpendingLimit() {
  const percentSpent = userData.budgetPercentage;
  
  const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
  const budgetWarnings = settings.budgetWarnings !== undefined ? settings.budgetWarnings : true;
  
  if (!budgetWarnings) return;
  
  if (percentSpent > 100) {
    const budgetCard = document.querySelector('.budget-card');
    if (budgetCard && !document.querySelector('.overspent-badge')) {
      const badge = document.createElement('div');
      badge.className = 'overspent-badge';
      badge.innerHTML = 'OVER BUDGET';
      badge.style.backgroundColor = 'var(--danger-color)';
      badge.style.color = 'white';
      badge.style.padding = '5px 10px';
      badge.style.borderRadius = '5px';
      badge.style.fontSize = '0.8rem';
      badge.style.fontWeight = 'bold';
      badge.style.position = 'absolute';
      badge.style.top = '10px';
      badge.style.right = '10px';
      
      budgetCard.style.position = 'relative';
      
      budgetCard.appendChild(badge);
    }
    
    const currentWeekSpentEl = document.getElementById('current-week-spent');
    if (currentWeekSpentEl) {
      currentWeekSpentEl.style.color = 'var(--danger-color)';
      currentWeekSpentEl.style.fontWeight = 'bold';
    }
  }
  
  if (percentSpent >= 80 && percentSpent < 100) {
    showWarning('Warning: You\'ve spent ' + percentSpent + '% of your weekly budget!');
    
    if (typeof notificationSystem !== 'undefined') {
      notificationSystem.sendBudgetWarning(percentSpent);
    }
  } else if (percentSpent >= 100) {
    showWarning('Alert: You\'ve exceeded your weekly budget by ' + (percentSpent - 100) + '%!');
    
    if (typeof notificationSystem !== 'undefined') {
      notificationSystem.sendBudgetWarning(percentSpent);
    }
  }
}

function showWarning(message) {
  const warning = document.createElement('div');
  warning.className = 'warning-alert';
  warning.innerHTML = `
    <div class="warning-content">
      <i class="fas fa-exclamation-triangle"></i>
      <span>${message}</span>
    </div>
    <button class="close-warning"><i class="fas fa-times"></i></button>
  `;
  
  document.body.prepend(warning);
  
  warning.style.position = 'fixed';
  warning.style.top = '20px';
  warning.style.left = '50%';
  warning.style.transform = 'translateX(-50%)';
  warning.style.backgroundColor = 'var(--warning-color)';
  warning.style.color = 'white';
  warning.style.padding = '10px 20px';
  warning.style.borderRadius = '5px';
  warning.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  warning.style.zIndex = '1000';
  warning.style.display = 'flex';
  warning.style.alignItems = 'center';
  warning.style.justifyContent = 'space-between';
  
  warning.querySelector('.close-warning').addEventListener('click', () => {
    warning.remove();
  });
  
  setTimeout(() => {
    warning.remove();
  }, 5000);
}

function addLogoutButton() {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  
  if (document.getElementById('logout')) return;
  
  const logoutItem = document.createElement('li');
  logoutItem.innerHTML = '<a href="#" id="logout"><i class="fas fa-sign-out-alt"></i> Logout</a>';
  menu.appendChild(logoutItem);
  
  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    logoutUser();
  });
}

async function logoutUser() {
  try {
    await fetchAPI('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('studentId');
    
    window.location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const errorParam = urlParams.get('error');
  
  if (errorParam === 'session_expired' && window.location.href.includes('login.html')) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = 'Your session has expired. Please log in again.';
      errorElement.style.display = 'block';
    }
  }
  
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  
  if (!window.location.href.includes('login.html')) {
    if (!token || !userId) {
      window.location.href = 'login.html';
      return;
    }
    
    addLogoutButton();
    
    try {
      await loadUserData();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      
      if (error.message.includes('Authentication')) {
        return;
      }
    }
    
    const refreshButton = document.getElementById('refresh');
    if (refreshButton) {
      refreshButton.addEventListener('click', refreshData);
    }
  }
  
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    const notificationPrompt = document.getElementById('notification-prompt');
    if (notificationPrompt) {
      notificationPrompt.style.display = 'block';
      
      const enableNotificationsBtn = document.getElementById('dashboard-enable-notifications');
      if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', () => {
          if (typeof notificationSystem !== 'undefined') {
            notificationSystem.requestPermission().then(granted => {
              if (granted) {
                notificationPrompt.style.display = 'none';
              }
            });
          }
        });
      }
    }
  }
}); 