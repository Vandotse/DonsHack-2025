
const fairyState = {
  myRequests: [],
  pendingRequests: [],
  acceptedRequests: [],
  fairyStatus: null,
  leaderboard: []
};

async function fetchFairyAPI(endpoint, options = {}) {
  try {
    const response = await fetchAPI(endpoint, options);
    console.log(`Fairy API response for ${endpoint}:`, response);
    return response;
  } catch (error) {
    console.error(`Fairy API error for ${endpoint}:`, error);
    showMessage(error.message || 'Failed to fetch data', 'error');
    return null;
  }
}

async function loadFairyStatus() {
  const statusData = await fetchFairyAPI('/api/fairy/status');
  if (statusData) {
    fairyState.fairyStatus = statusData;
    updateFairyStatusUI();
  }
  return statusData;
}

async function toggleFairyStatus(isActive, maxAmount) {
  const data = await fetchFairyAPI('/api/fairy/toggle', {
    method: 'POST',
    body: JSON.stringify({
      is_active: isActive,
      max_transaction_amount: maxAmount || null
    })
  });
  if (data) {
    fairyState.fairyStatus = data;
    updateFairyStatusUI();
    showMessage(isActive ? 'You are now an active Flexi Fairy!' : 'Flexi Fairy status deactivated');
  }
  return data;
}

async function loadMyRequests() {
  const data = await fetchFairyAPI('/api/fairy/requests');
  if (data && data.requests) {
    fairyState.myRequests = data.requests;
    updateMyRequestsUI();
  }
  return data;
}

async function loadPendingRequests() {
  const data = await fetchFairyAPI('/api/fairy/requests/pending');
  if (data && data.requests) {
    fairyState.pendingRequests = data.requests;
    updatePendingRequestsUI();
  }
  return data;
}

async function loadAcceptedRequests() {
  const data = await fetchFairyAPI('/api/fairy/requests/accepted');
  if (data && data.requests) {
    fairyState.acceptedRequests = data.requests;
    updateAcceptedRequestsUI();
  }
  return data;
}

async function createRequest(location, amount, description) {
  const data = await fetchFairyAPI('/api/fairy/request', {
    method: 'POST',
    body: JSON.stringify({
      location,
      amount,
      description
    })
  });
  if (data && data.success) {
    showMessage('Request created successfully!');
    await loadMyRequests();
    return true;
  }
  return false;
}

async function acceptRequest(requestId) {
  const data = await fetchFairyAPI('/api/fairy/request/accept', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId
    })
  });
  if (data && data.success) {
    showMessage('Request accepted!');
    await loadPendingRequests();
    await loadAcceptedRequests();
    return true;
  }
  return false;
}

async function cancelRequest(requestId) {
  const data = await fetchFairyAPI('/api/fairy/request/cancel', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId
    })
  });
  if (data && data.success) {
    showMessage('Request cancelled');
    await loadMyRequests();
    return true;
  }
  return false;
}

async function confirmRequest(requestId) {
  const data = await fetchFairyAPI('/api/fairy/request/confirm', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId
    })
  });
  if (data && data.success) {
    showMessage('Request confirmed!');
    await loadAcceptedRequests();
    return true;
  }
  return false;
}

async function rateRequest(requestId, rating, comment) {
  const data = await fetchFairyAPI('/api/fairy/request/rate', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId,
      rating,
      comment
    })
  });
  if (data && data.success) {
    showMessage('Thank you for your rating!');
    await loadMyRequests();
    return true;
  }
  return false;
}

async function loadLeaderboard(timeframe = 'all') {
  const data = await fetchFairyAPI(`/api/fairy/leaderboard?timeframe=${timeframe}`);
  if (data && data.fairies) {
    fairyState.leaderboard = data.fairies;
    updateLeaderboardUI();
  }
  return data;
}


function updateFairyStatusUI() {
  const status = fairyState.fairyStatus;
  
  const statusToggle = document.getElementById('fairy-status-toggle');
  if (statusToggle) {
    statusToggle.checked = status?.is_active;
  }
  
  const maxAmountInput = document.getElementById('max-transaction-amount');
  if (maxAmountInput) {
    maxAmountInput.value = status?.max_transaction_amount || '';
  }
  
  const totalHelped = document.getElementById('total-helped-amount');
  if (totalHelped) {
    totalHelped.textContent = (status?.total_helped_amount || 0).toFixed(2);
  }
  
  const totalRequests = document.getElementById('total-requests-fulfilled');
  if (totalRequests) {
    totalRequests.textContent = status?.total_requests_fulfilled || 0;
  }
  
  const ratingAvg = document.getElementById('rating-average');
  if (ratingAvg) {
    ratingAvg.textContent = (status?.rating_average || 0).toFixed(1);
  }
  
  const statusBadge = document.getElementById('fairy-status-badge');
  if (statusBadge) {
    statusBadge.textContent = status?.is_active ? 'Active' : 'Inactive';
    statusBadge.className = status?.is_active ? 'status-badge active' : 'status-badge inactive';
  }
}

function createRequestCardHTML(request) {
  const statusClasses = {
    'pending': 'pending',
    'accepted': 'accepted',
    'completed': 'completed',
    'cancelled': 'cancelled'
  };
  
  const statusText = {
    'pending': 'Pending',
    'accepted': 'Accepted',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  
  const statusClass = statusClasses[request.status] || 'pending';
  
  let buttons = '';
  
  if (request.requestor_id == localStorage.getItem('userId')) {
    if (request.status === 'pending') {
      buttons = `<button class="cancel-button" onclick="cancelRequest(${request.id})">Cancel</button>`;
    } else if (request.status === 'accepted' && !request.requestor_confirmed) {
      buttons = `<button class="rate-button" onclick="showRatingForm(${request.id})">Rate & Confirm</button>`;
    }
  } 
  else if (request.fairy_id == localStorage.getItem('userId')) {
    if (request.status === 'accepted' && !request.fairy_confirmed) {
      buttons = `<button class="confirm-button" onclick="confirmRequest(${request.id})">Confirm Completed</button>`;
    }
  }
  
  return `
    <div class="request-card ${statusClass}" data-id="${request.id}">
      <div class="request-header">
        <h3>Request #${request.id}</h3>
        <span class="request-status ${statusClass}">${statusText[request.status]}</span>
      </div>
      <div class="request-details">
        <div class="detail-item">
          <div class="label">Location</div>
          <div class="value">${request.location}</div>
        </div>
        <div class="detail-item">
          <div class="label">Amount</div>
          <div class="value">$${parseFloat(request.amount).toFixed(2)}</div>
        </div>
        <div class="detail-item">
          <div class="label">Date</div>
          <div class="value">${new Date(request.created_at).toLocaleString()}</div>
        </div>
        ${request.fairy_name ? `
        <div class="detail-item">
          <div class="label">Fairy</div>
          <div class="value">${request.fairy_name}</div>
        </div>
        ` : ''}
      </div>
      ${request.description ? `
      <div class="request-description">
        <p>${request.description}</p>
      </div>
      ` : ''}
      ${buttons ? `
      <div class="request-buttons">
        ${buttons}
      </div>
      ` : ''}
    </div>
  `;
}

function updateMyRequestsUI() {
  const requestsContainer = document.getElementById('my-requests');
  if (!requestsContainer) return;
  
  if (!fairyState.myRequests || fairyState.myRequests.length === 0) {
    requestsContainer.innerHTML = '<div class="empty-state">You have no requests yet</div>';
    return;
  }
  
  const html = fairyState.myRequests.map(request => createRequestCardHTML(request)).join('');
  requestsContainer.innerHTML = html;
}

function updatePendingRequestsUI() {
  const requestsContainer = document.getElementById('pending-requests');
  if (!requestsContainer) return;
  
  if (!fairyState.pendingRequests || fairyState.pendingRequests.length === 0) {
    requestsContainer.innerHTML = '<div class="empty-state">No pending requests available</div>';
    return;
  }
  
  let html = '';
  for (const request of fairyState.pendingRequests) {
    html += `
      <div class="request-card pending" data-id="${request.id}">
        <div class="request-header">
          <h3>Request #${request.id}</h3>
          <span class="request-status pending">Pending</span>
        </div>
        <div class="request-details">
          <div class="detail-item">
            <div class="label">Requestor</div>
            <div class="value">${request.requestor_name}</div>
          </div>
          <div class="detail-item">
            <div class="label">Location</div>
            <div class="value">${request.location}</div>
          </div>
          <div class="detail-item">
            <div class="label">Amount</div>
            <div class="value">$${parseFloat(request.amount).toFixed(2)}</div>
          </div>
          <div class="detail-item">
            <div class="label">Date</div>
            <div class="value">${new Date(request.created_at).toLocaleString()}</div>
          </div>
        </div>
        ${request.description ? `
        <div class="request-description">
          <p>${request.description}</p>
        </div>
        ` : ''}
        <div class="request-buttons">
          <button class="confirm-button" onclick="acceptRequest(${request.id})">Accept Request</button>
        </div>
      </div>
    `;
  }
  
  requestsContainer.innerHTML = html;
}

function updateAcceptedRequestsUI() {
  const requestsContainer = document.getElementById('accepted-requests');
  if (!requestsContainer) return;
  
  if (!fairyState.acceptedRequests || fairyState.acceptedRequests.length === 0) {
    requestsContainer.innerHTML = '<div class="empty-state">You have no accepted requests</div>';
    return;
  }
  
  let html = '';
  for (const request of fairyState.acceptedRequests) {
    const confirmed = request.fairy_confirmed ? 'confirmed' : '';
    
    html += `
      <div class="request-card accepted ${confirmed}" data-id="${request.id}">
        <div class="request-header">
          <h3>Request #${request.id}</h3>
          <span class="request-status accepted">Accepted${request.fairy_confirmed ? ' (Confirmed)' : ''}</span>
        </div>
        <div class="request-details">
          <div class="detail-item">
            <div class="label">Requestor</div>
            <div class="value">${request.requestor_name}</div>
          </div>
          <div class="detail-item">
            <div class="label">Location</div>
            <div class="value">${request.location}</div>
          </div>
          <div class="detail-item">
            <div class="label">Amount</div>
            <div class="value">$${parseFloat(request.amount).toFixed(2)}</div>
          </div>
          <div class="detail-item">
            <div class="label">Date</div>
            <div class="value">${new Date(request.created_at).toLocaleString()}</div>
          </div>
        </div>
        ${request.description ? `
        <div class="request-description">
          <p>${request.description}</p>
        </div>
        ` : ''}
        ${!request.fairy_confirmed ? `
        <div class="request-buttons">
          <button class="confirm-button" onclick="confirmRequest(${request.id})">Confirm Completed</button>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  requestsContainer.innerHTML = html;
}

function updateLeaderboardUI() {
  const leaderboardContainer = document.getElementById('leaderboard');
  if (!leaderboardContainer) return;
  
  if (!fairyState.leaderboard || fairyState.leaderboard.length === 0) {
    leaderboardContainer.innerHTML = '<div class="empty-state">No fairies on the leaderboard yet</div>';
    return;
  }
  
  let html = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Amount Helped</th>
          <th>Requests</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  fairyState.leaderboard.forEach((fairy, index) => {
    html += `
      <tr>
        <td>#${index + 1}</td>
        <td>${fairy.name}</td>
        <td>$${parseFloat(fairy.amount_helped).toFixed(2)}</td>
        <td>${fairy.requests_fulfilled}</td>
        <td>${fairy.rating ? parseFloat(fairy.rating).toFixed(1) : 'N/A'}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  leaderboardContainer.innerHTML = html;
}

function showRatingForm(requestId) {
  const requestCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
  if (!requestCard) return;
  
  if (requestCard.querySelector('.rating-form')) return;
  
  const ratingForm = document.createElement('div');
  ratingForm.className = 'rating-form';
  ratingForm.innerHTML = `
    <h4>Rate Your Fairy</h4>
    <div class="stars" data-rating="0">
      <i class="fas fa-star" data-value="1"></i>
      <i class="fas fa-star" data-value="2"></i>
      <i class="fas fa-star" data-value="3"></i>
      <i class="fas fa-star" data-value="4"></i>
      <i class="fas fa-star" data-value="5"></i>
    </div>
    <textarea placeholder="Leave a comment (optional)" class="rating-comment"></textarea>
    <div class="request-buttons">
      <button class="cancel-button" onclick="hideRatingForm(${requestId})">Cancel</button>
      <button class="confirm-button" onclick="submitRating(${requestId})">Submit Rating</button>
    </div>
  `;
  
  requestCard.appendChild(ratingForm);
  
  const stars = ratingForm.querySelectorAll('.stars i');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const value = parseInt(star.getAttribute('data-value'));
      const starsContainer = star.parentElement;
      
      starsContainer.setAttribute('data-rating', value);
      
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-value')) <= value) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
  });
}

function hideRatingForm(requestId) {
  const requestCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
  if (!requestCard) return;
  
  const ratingForm = requestCard.querySelector('.rating-form');
  if (ratingForm) {
    ratingForm.remove();
  }
}

async function submitRating(requestId) {
  const requestCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
  if (!requestCard) return;
  
  const ratingForm = requestCard.querySelector('.rating-form');
  if (!ratingForm) return;
  
  const starsContainer = ratingForm.querySelector('.stars');
  const rating = parseInt(starsContainer.getAttribute('data-rating'));
  
  if (!rating || rating < 1 || rating > 5) {
    showMessage('Please select a rating from 1 to 5 stars', 'error');
    return;
  }
  
  const comment = ratingForm.querySelector('.rating-comment').value;
  
  const success = await rateRequest(requestId, rating, comment);
  if (success) {
    hideRatingForm(requestId);
  }
}

async function createDemoData() {
  const demoDone = localStorage.getItem('demoDataCreated');
  if (demoDone) return;
  
  console.log('Creating demo data...');
  
  try {
    await toggleFairyStatus(true, 50);
    console.log('Enabled fairy status');
    
    const locations = ['Lone Mountain', 'Market Cafe', 'Wolf & Kettle', 'Crossroads Cafe'];
    const amounts = [10.99, 15.50, 8.75, 12.25];
    const descriptions = [
      'Need help with lunch today!',
      'Running low on flexi, would appreciate help',
      'Forgot my wallet and need food',
      'Any fairy available to help with dinner?'
    ];
    
    for (let i = 0; i < 3; i++) {
      const location = locations[i % locations.length];
      const amount = amounts[i % amounts.length];
      const description = descriptions[i % descriptions.length];
      
      await createRequest(location, amount, description);
      console.log(`Created demo request ${i+1}`);
    }
    
    localStorage.setItem('demoDataCreated', 'true');
    console.log('Demo data created successfully');
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  if (currentPage === 'fairy-request.html') {
    console.log('Initializing fairy request page');
    try {
      await loadMyRequests();
      
      const requestForm = document.getElementById('request-form');
      if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const location = document.getElementById('request-location').value;
          const amount = parseFloat(document.getElementById('request-amount').value);
          const description = document.getElementById('request-description').value;
          
          if (!location || isNaN(amount) || amount <= 0) {
            showMessage('Please fill out all required fields', 'error');
            return;
          }
          
          const success = await createRequest(location, amount, description);
          if (success) {
            requestForm.reset();
          }
        });
      }
      
      await createDemoData();
    } catch (error) {
      console.error('Error initializing fairy request page:', error);
    }
  } 
  else if (currentPage === 'fairy-dashboard.html') {
    console.log('Initializing fairy dashboard page');
    try {
      await loadFairyStatus();
      await loadPendingRequests();
      await loadAcceptedRequests();
      
      const statusToggle = document.getElementById('fairy-status-toggle');
      if (statusToggle) {
        statusToggle.addEventListener('change', async (e) => {
          const isActive = e.target.checked;
          const maxAmount = document.getElementById('max-transaction-amount')?.value || null;
          await toggleFairyStatus(isActive, maxAmount);
        });
      }
      
      const maxAmountInput = document.getElementById('max-transaction-amount');
      if (maxAmountInput) {
        maxAmountInput.addEventListener('change', async (e) => {
          if (statusToggle && statusToggle.checked) {
            const maxAmount = e.target.value || null;
            await toggleFairyStatus(true, maxAmount);
          }
        });
      }
      
      const refreshButton = document.getElementById('refresh-requests');
      if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
          await loadPendingRequests();
          await loadAcceptedRequests();
          showMessage('Requests refreshed');
        });
      }
    } catch (error) {
      console.error('Error initializing fairy dashboard page:', error);
    }
  }
  else if (currentPage === 'fairy-leaderboard.html') {
    console.log('Initializing fairy leaderboard page');
    try {
      await loadLeaderboard();
      
      const timeframeSelect = document.getElementById('timeframe-select');
      if (timeframeSelect) {
        timeframeSelect.addEventListener('change', async (e) => {
          await loadLeaderboard(e.target.value);
        });
      }
    } catch (error) {
      console.error('Error initializing fairy leaderboard page:', error);
    }
  }
}); 