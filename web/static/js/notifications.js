const notificationSystem = {
  notificationsEnabled: false,
  
  init: function() {
    this.checkPermission();
    this.loadSettings();
    this.attachEventListeners();
  },
  
  checkPermission: function() {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notifications");
      return false;
    }
    
    if (Notification.permission === "granted") {
      this.notificationsEnabled = true;
      return true;
    } else if (Notification.permission !== "denied") {
      return false;
    }
    
    return false;
  },
  
  requestPermission: function() {
    return new Promise((resolve, reject) => {
      Notification.requestPermission()
        .then(permission => {
          if (permission === "granted") {
            this.notificationsEnabled = true;
            this.sendWelcomeNotification();
            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch(err => {
          console.error("Error requesting notification permission:", err);
          reject(err);
        });
    });
  },
  
  loadSettings: function() {
    const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    
    this.budgetWarnings = settings.budgetWarnings !== undefined ? settings.budgetWarnings : true;
    this.strictBudget = settings.strictBudget !== undefined ? settings.strictBudget : false;
    this.transactionNotifications = settings.transactionNotifications !== undefined ? settings.transactionNotifications : true;
    this.weeklyReports = settings.weeklyReports !== undefined ? settings.weeklyReports : true;
  },
  
  attachEventListeners: function() {
    document.addEventListener('DOMContentLoaded', () => {
      const notificationBtn = document.getElementById('notifications');
      if (notificationBtn) {
        notificationBtn.addEventListener('click', () => this.showNotificationCenter());
      }
      
      const enableNotificationsBtn = document.getElementById('enable-notifications');
      if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', () => this.requestPermission());
      }
    });
  },
  
  sendWelcomeNotification: function() {
    this.sendNotification(
      "Notifications Enabled", 
      "You'll now receive budget and transaction alerts from FlexiBudget."
    );
  },
  
  sendNotification: function(title, message, options = {}) {
    if (!this.notificationsEnabled) {
      console.log("Notifications not enabled");
      return false;
    }
    
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notifications");
      return false;
    }
    
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: message,
        icon: '/web/static/img/usfca-logo.png',
        ...options
      });
      
      notification.onclick = function() {
        window.focus();
        notification.close();
      };
      
      return true;
    }
    
    return false;
  },
  
  sendBudgetWarning: function(percentage) {
    if (!this.budgetWarnings) return false;
    
    let title, message;
    
    if (percentage >= 100) {
      title = "Budget Alert!";
      message = `You've exceeded your weekly budget (${percentage}%).`;
    } else if (percentage >= 80) {
      title = "Budget Warning";
      message = `You've spent ${percentage}% of your weekly budget.`;
    } else {
      return false;
    }
    
    return this.sendNotification(title, message, {
      tag: 'budget-warning',
      requireInteraction: true
    });
  },
  
  sendTransactionNotification: function(transaction) {
    if (!this.transactionNotifications) return false;
    
    const title = "New Transaction";
    const message = `${transaction.name}: $${transaction.amount.toFixed(2)}`;
    
    return this.sendNotification(title, message, {
      tag: 'transaction'
    });
  },
  
  sendWeeklyReportNotification: function(spent, budget) {
    if (!this.weeklyReports) return false;
    
    const percentage = Math.round((spent / budget) * 100);
    const title = "Weekly Spending Report";
    const message = `You spent $${spent.toFixed(2)} (${percentage}% of your $${budget.toFixed(2)} budget).`;
    
    return this.sendNotification(title, message, {
      tag: 'weekly-report'
    });
  },
  
  showNotificationCenter: function() {
    if (!this.notificationsEnabled && Notification.permission !== "denied") {
      this.requestPermission()
        .then(granted => {
          if (granted) {
            alert("Notifications enabled!");
          } else {
            alert("Please enable notifications to receive budget alerts.");
          }
        });
    } else if (Notification.permission === "denied") {
      alert("Notifications are blocked. Please enable them in your browser settings to receive budget alerts.");
    } else {
      alert("You have no new notifications");
    }
  }
};

notificationSystem.init(); 