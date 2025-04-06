// API helper function
async function fetchAPI(endpoint, options = {}) {
  // Add auth token to headers if available
  const token = localStorage.getItem('authToken');
  
  console.log('Auth token from localStorage:', token ? 'Present (length: ' + token.length + ')' : 'Not found');
  
  // If token is required and not available, redirect to login
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
    
    // Handle 401 Unauthorized before parsing JSON
    if (response.status === 401) {
      console.error('Authentication failed (401) for endpoint:', endpoint);
      
      // Only clear auth data and redirect if we're not already on the login page
      if (!window.location.href.includes('login.html')) {
        // Clear invalid auth data and redirect to login
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

// User data placeholder (will be populated from API)
let userData = {
  username: localStorage.getItem('userName') || "Student",
  startingBalance: 0,
  currentBalance: 0,
  spent: 0,
  weeklyBudget: 0,
  currentWeekSpent: 0,
  budgetPercentage: 0
};

// Load user data from API
async function loadUserData() {
  try {
    // Get user balance
    const balance = await fetchAPI('/api/users/me/balance');
    
    // Get budget settings
    const budget = await fetchAPI('/api/budget');
    
    // Update user data
    userData = {
      username: localStorage.getItem('userName') || "Student",
      startingBalance: balance.starting_balance,
      currentBalance: balance.current_balance,
      spent: balance.spent_amount,
      weeklyBudget: budget.weekly_budget,
      
      // Calculate the weekly spent - don't cap it at the budget amount
      currentWeekSpent: balance.spent_amount,
        
      // Calculate budget percentage - don't cap at 100% to show values over budget
      budgetPercentage: Math.round((balance.spent_amount / budget.weekly_budget) * 100)
    };
    
    updateUI();
  } catch (error) {
    console.error('Failed to load user data:', error);
    
    // If unauthorized, redirect to login
    if (error.message.includes('Unauthorized')) {
      logoutUser();
    }
  }
}

// Update UI with user data
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
  
  // Display actual percentage - can exceed 100%
  if (budgetPercentageEl) budgetPercentageEl.textContent = userData.budgetPercentage + '%';
  
  // Cap the progress bar width at 100% for visual purposes
  if (budgetProgressEl) budgetProgressEl.style.width = Math.min(userData.budgetPercentage, 100) + '%';
  
  // Update progress bar color
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

// Refresh data from API
async function refreshData() {
  try {
    await loadUserData();
    if (typeof loadTransactions === 'function') {
      await loadTransactions();
    }
    
    // Show success message
    showMessage('Data refreshed successfully');
  } catch (error) {
    showMessage('Failed to refresh data', 'error');
  }
}

// Show a temporary message
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

// Check spending limit and show warnings
function checkSpendingLimit() {
  const percentSpent = userData.budgetPercentage;
  
  // Get settings from localStorage (will be replaced with API data later)
  const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
  const budgetWarnings = settings.budgetWarnings !== undefined ? settings.budgetWarnings : true;
  
  if (!budgetWarnings) return;
  
  // Add an overspending indicator if budget exceeded
  if (percentSpent > 100) {
    // Add a badge to the budget card if it exists
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
      
      // Need to ensure the budget card has position relative
      budgetCard.style.position = 'relative';
      
      budgetCard.appendChild(badge);
    }
    
    // Also update the spent amount/budget UI to highlight overspending
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

// Show warning message
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

// Add logout button to sidebar
function addLogoutButton() {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  
  // Check if logout button already exists
  if (document.getElementById('logout')) return;
  
  const logoutItem = document.createElement('li');
  logoutItem.innerHTML = '<a href="#" id="logout"><i class="fas fa-sign-out-alt"></i> Logout</a>';
  menu.appendChild(logoutItem);
  
  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    logoutUser();
  });
}

// Logout user
async function logoutUser() {
  try {
    // Call logout API (optional)
    await fetchAPI('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('studentId');
    
    // Redirect to login
    window.location.href = 'login.html';
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const errorParam = urlParams.get('error');
  
  // Show error message if session expired
  if (errorParam === 'session_expired' && window.location.href.includes('login.html')) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = 'Your session has expired. Please log in again.';
      errorElement.style.display = 'block';
    }
  }
  
  // Check if user is logged in
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  
  // If this is not the login page, enforce authentication
  if (!window.location.href.includes('login.html')) {
    if (!token || !userId) {
      // Redirect to login if not authenticated
      window.location.href = 'login.html';
      return;
    }
    
    // Add logout button
    addLogoutButton();
    
    // Load user data (this will also validate the token)
    try {
      await loadUserData();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      
      // If authentication fails during data loading, don't proceed
      if (error.message.includes('Authentication')) {
        return;
      }
    }
    
    // Add refresh button handler if present
    const refreshButton = document.getElementById('refresh');
    if (refreshButton) {
      refreshButton.addEventListener('click', refreshData);
    }
  }
  
  // Show notification prompt if browser supports it and permission not granted yet
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