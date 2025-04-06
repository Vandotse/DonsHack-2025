
document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  const sidebarHTML = `
    <div class="logo">
      <img src="static/img/usfca-logo.png" alt="USFCA Logo">
      <h1>FlexiBudget</h1>
    </div>
    <ul class="menu">
      <li${currentPage === 'index.html' ? ' class="active"' : ''}><a href="index.html"><i class="fas fa-home"></i> Dashboard</a></li>
      <li${currentPage === 'transactions.html' ? ' class="active"' : ''}><a href="transactions.html"><i class="fas fa-history"></i> Transactions</a></li>
      <li${currentPage === 'dining.html' ? ' class="active"' : ''}><a href="dining.html"><i class="fas fa-utensils"></i> Campus Dining</a></li>
      <li${currentPage === 'fairy-request.html' ? ' class="active"' : ''}><a href="fairy-request.html"><i class="fas fa-magic"></i> Request Help</a></li>
      <li${currentPage === 'fairy-dashboard.html' ? ' class="active"' : ''}><a href="fairy-dashboard.html"><i class="fas fa-hands-helping"></i> Fairy Dashboard</a></li>
      <li${currentPage === 'fairy-leaderboard.html' ? ' class="active"' : ''}><a href="fairy-leaderboard.html"><i class="fas fa-trophy"></i> Leaderboard</a></li>
      <li${currentPage === 'settings.html' ? ' class="active"' : ''}><a href="settings.html"><i class="fas fa-cog"></i> Settings</a></li>
    </ul>
    <div class="sidebar-footer">
      <p>Version 0.1.0</p>
      <a href="#" id="logout" style="color: #666; text-decoration: none; display: block; margin-top: 10px;"><i class="fas fa-sign-out-alt"></i> Logout</a>
    </div>
  `;
  
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.innerHTML = sidebarHTML;
    
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
      logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof logoutUser === 'function') {
          logoutUser();
        } else {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('userName');
          localStorage.removeItem('studentId');
          window.location.href = 'login.html';
        }
      });
    }
  }
}); 