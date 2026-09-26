/**
 * Finage OS v3 - Chart.js Visualizer Manager (Clean White, Aqua & Pale Orange Palette)
 */

const ChartManager = {
  instances: {},

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  /**
   * Renders the Inflow vs Outflow multi-horizon forecast chart
   */
  renderForecastChart(canvasId, projectionData) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = projectionData.map(p => p.period);
    const inflows = projectionData.map(p => Math.round(p.totalInflows));
    const outflows = projectionData.map(p => Math.round(p.totalOutflows));
    const netCash = projectionData.map(p => Math.round(p.netCashFlow));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Projected Inflows',
            data: inflows,
            backgroundColor: 'rgba(13, 148, 136, 0.75)', // Light Aqua
            borderColor: '#0d9488',
            borderWidth: 1,
            borderRadius: 4,
            order: 2
          },
          {
            label: 'Projected Outflows',
            data: outflows,
            backgroundColor: 'rgba(249, 115, 22, 0.7)', // Pale Orange
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 4,
            order: 2
          },
          {
            label: 'Net Cash Flow',
            data: netCash,
            type: 'line',
            borderColor: '#0f766e',
            backgroundColor: 'rgba(15, 118, 110, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#0d9488',
            pointRadius: 4,
            tension: 0.3,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${Formatter.money(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 10 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Formatter.money(val, true)
            }
          }
        }
      }
    });
  },

  /**
   * Renders Asset vs Liability Maturity Ladder Gap Chart
   */
  renderMaturityLadderChart(canvasId, ladderData) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = ladderData.map(b => b.bucket);
    const assets = ladderData.map(b => b.assets);
    const liabilities = ladderData.map(b => b.liabilities);
    const netGaps = ladderData.map(b => b.netGap);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Maturing Assets (Loans & Placements)',
            data: assets,
            backgroundColor: 'rgba(13, 148, 136, 0.8)', // Aqua
            borderRadius: 4
          },
          {
            label: 'Maturing Liabilities (Deposits & Borrowing)',
            data: liabilities,
            backgroundColor: 'rgba(251, 146, 60, 0.8)', // Pale Orange
            borderRadius: 4
          },
          {
            label: 'Net Maturity Gap',
            data: netGaps,
            type: 'line',
            borderColor: '#0f766e',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${Formatter.money(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: { color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Formatter.money(val, true)
            }
          }
        }
      }
    });
  },

  /**
   * Renders Stress-Testing Trajectory Chart
   */
  renderStressTrajectoryChart(canvasId, simData) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = simData.trajectory.map(t => t.label);
    const baseData = simData.trajectory.map(t => t.baseCash);
    const stressedData = simData.trajectory.map(t => t.stressedCash);
    const floorData = simData.trajectory.map(t => t.statutoryFloor);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Base Case Trajectory',
            data: baseData,
            borderColor: '#0d9488', // Aqua
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: 'Stressed Cash Position',
            data: stressedData,
            borderColor: '#f97316', // Pale Orange
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            borderWidth: 2.5,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#f97316',
            tension: 0.3
          },
          {
            label: '15% Statutory Floor ($4.28M)',
            data: floorData,
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${Formatter.money(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: { color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Formatter.money(val, true)
            }
          }
        }
      }
    });
  },

  /**
   * Renders Portfolio Risk / PAR Quality Donut Chart
   */
  renderPortfolioDonut(canvasId, pqMetrics) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Performing (0-29 Days)', 'Watch (30-59 Days)', 'Substandard (60-89 Days)', 'Doubtful/Loss (90+ Days)'],
        datasets: [{
          data: [
            pqMetrics.performingAmount,
            pqMetrics.par30Amount,
            pqMetrics.par60Amount,
            pqMetrics.par90Amount
          ],
          backgroundColor: [
            '#0d9488', // Light Aqua
            '#fed7aa', // Very Pale Orange
            '#fb923c', // Warm Orange
            '#ef4444'  // Rose
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 10 }, boxWidth: 10 }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: function(context) {
                return `${context.label}: ${Formatter.money(context.raw)} (${((context.raw / pqMetrics.grossPortfolio) * 100).toFixed(1)}%)`;
              }
            }
          }
        }
      }
    });
  }
};

window.ChartManager = ChartManager;
