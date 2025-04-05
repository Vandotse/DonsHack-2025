document.addEventListener('DOMContentLoaded', () => {
  renderSpendingChart();
});

function renderSpendingChart() {
  const ctx = document.getElementById('spending-chart').getContext('2d');
  
  const weeklySpending = [
    { week: 'Week 1', amount: 85.50 },
    { week: 'Week 2', amount: 92.25 },
    { week: 'Week 3', amount: 78.80 },
    { week: 'Week 4', amount: 45.00 }, 
  ];
  
  const labels = weeklySpending.map(item => item.week);
  const data = weeklySpending.map(item => item.amount);
  
  const usfcaGreen = '#00543C';
  const usfcaGold = '#FDBB30';
  
  const spendingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Weekly Spending ($)',
        data: data,
        backgroundColor: [
          'rgba(0, 84, 60, 0.6)', 
          'rgba(0, 84, 60, 0.6)',  
          'rgba(0, 84, 60, 0.6)',  
          'rgba(253, 187, 48, 0.8)' 
        ],
        borderColor: [
          'rgba(0, 84, 60, 1)',    
          'rgba(0, 84, 60, 1)',    
          'rgba(0, 84, 60, 1)',    
          'rgba(253, 187, 48, 1)'  
        ],
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `$${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: function(value) {
              return '$' + value;
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
  
  document.querySelector('.spending-card').style.height = '300px';
}

function updateChartWithNewTransaction(amount) {
  renderSpendingChart();
} 