// Analytics Charts Handler using Chart.js
import Chart from 'chart.js/auto';

let weeklyChartInstance = null;
let categoryChartInstance = null;

export const renderAnalyticsCharts = (taskManager) => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  // 1. Weekly Completion Bar Chart Data (Last 7 days)
  const daysLabels = [];
  const completedCounts = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
    daysLabels.push(`${d.getMonth() + 1}/${d.getDate()} (${dayName})`);

    // Count tasks completed on this date
    const count = taskManager.tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      return t.completedAt.startsWith(dateStr);
    }).length;
    completedCounts.push(count);
  }

  const weeklyCanvas = document.getElementById('weeklyChart');
  if (weeklyCanvas) {
    if (weeklyChartInstance) {
      weeklyChartInstance.destroy();
    }
    weeklyChartInstance = new Chart(weeklyCanvas, {
      type: 'bar',
      data: {
        labels: daysLabels,
        datasets: [{
          label: '완료된 할 일 (개)',
          data: completedCounts,
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          hoverBackgroundColor: 'rgba(99, 102, 241, 1)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: 'transparent' }
          },
          y: {
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 }, stepSize: 1 },
            grid: { color: gridColor },
            beginAtZero: true
          }
        }
      }
    });
  }

  // 2. Category Distribution Doughnut Chart
  const categories = taskManager.categories;
  const catNames = [];
  const catCounts = [];
  const catColors = [];

  categories.forEach(cat => {
    const count = taskManager.tasks.filter(t => t.categoryId === cat.id).length;
    if (count > 0 || categories.length <= 5) {
      catNames.push(cat.name);
      catCounts.push(count);
      catColors.push(cat.color || '#6366f1');
    }
  });

  const categoryCanvas = document.getElementById('categoryChart');
  if (categoryCanvas) {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }
    categoryChartInstance = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: catNames,
        datasets: [{
          data: catCounts,
          backgroundColor: catColors,
          borderWidth: 2,
          borderColor: isDark ? '#1e2433' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 12 }, padding: 16 }
          }
        },
        cutout: '70%'
      }
    });
  }
};
