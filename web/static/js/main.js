const userData = {
  username: sessionStorage.getItem('username') || "John Doe",
  startingBalance: 1500.00,
  currentBalance: 1250.00,
  spent: 250.00,
  weeklyBudget: 100.00,
  currentWeekSpent: 45.00,
  budgetPercentage: 45
};

const transactions = [
  { 
    id: 1, 
    name: "Campus Café", 
    amount: 12.50, 
    date: "2023-10-25T12:30:00", 
    icon: "fa-utensils" 
  },
  { 
    id: 2, 
    name: "University Bookstore", 
    amount: 65.75, 
    date: "2023-10-24T15:45:00", 
    icon: "fa-book" 
  },
  { 
    id: 3, 
    name: "Student Center", 
    amount: 8.25, 
    date: "2023-10-24T10:15:00", 
    icon: "fa-mug-hot" 
  },
  { 
    id: 4, 
    name: "Food Truck Rally", 
    amount: 15.00, 
    date: "2023-10-23T13:20:00", 
    icon: "fa-truck" 
  },
  { 
    id: 5, 
    name: "Late Night Grill", 
    amount: 18.50, 
    date: "2023-10-22T21:30:00", 
    icon: "fa-hamburger" 
  }
];

document.addEventListener('DOMContentLoaded', () => {
  if (!sessionStorage.getItem('username') && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
    return;
  }
  
  document.getElementById('username').textContent = userData.username;
  document.getElementById('current-balance').textContent = userData.currentBalance.toFixed(2);
  document.getElementById('starting-balance').textContent = userData.startingBalance.toFixed(2);
  document.getElementById('spent-amount').textContent = userData.spent.toFixed(2);
  
  document.getElementById('weekly-budget').textContent = userData.weeklyBudget.toFixed(2);
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
  
  document.getElementById('refresh').addEventListener('click', refreshData);
  document.getElementById('notifications').addEventListener('click', showNotifications);
  
  if (document.querySelector('.sidebar')) {
    addLogoutButton();
  }
});

function refreshData() {
  alert('Refreshing data from server...');
}

function showNotifications() {
  alert('You have no new notifications');
}

function checkSpendingLimit() {
  const percentSpent = userData.budgetPercentage;
  
  if (percentSpent >= 80 && percentSpent < 100) {
    showWarning('Warning: You\'ve spent ' + percentSpent + '% of your weekly budget!');
  } else if (percentSpent >= 100) {
    showWarning('Alert: You\'ve exceeded your weekly budget!');
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
  const logoutItem = document.createElement('li');
  logoutItem.innerHTML = `<a href="#" id="logout"><i class="fas fa-sign-out-alt"></i> Logout</a>`;
  
  menu.appendChild(logoutItem);
  
  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    
    sessionStorage.removeItem('username');
    
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('budget-progress')) {
    checkSpendingLimit();
  }
}); 