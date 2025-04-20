document.addEventListener('DOMContentLoaded', function() {
    const REQUEST_LIMIT_PER_DAY = 1000;
    let currentChart = null;
    let projectId = null;
    let project = null;

    // Initialize the dashboard
    initDashboard();

    function initDashboard() {
        projectId = getProjectIdFromUrl();
        project = loadProject(projectId);
        
        if (!project) {
            showAlert('Project not found! Redirecting...', 'danger');
            setTimeout(() => window.location.href = 'home.html', 2000);
            return;
        }

        // Initialize UI
        updateProjectUI(project);
        initUsageChart(project);
        setupTabs();
        setupCopyButtons();
        setupTimeframeButtons();

        // Setup back button
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = 'home.html';
        });

        // Setup simulate request button
        document.getElementById('simulateRequestBtn').addEventListener('click', simulateRequest);
    }

    // Helper functions
    function getProjects() {
        try {
            const projects = JSON.parse(localStorage.getItem('shadowGateProjects4')) || [];
            return Array.isArray(projects) ? projects.filter(p => p && p.id) : [];
        } catch (e) {
            console.error('Resetting corrupted data...', e);
            localStorage.setItem('shadowGateProjects4', JSON.stringify([]));
            return [];
        }
    }

    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('project');
    }

    function loadProject(projectId) {
        if (!projectId) return null;
        return getProjects().find(p => p.id === projectId);
    }

    function updateProjectUI(project) {
        if (!project) return;

        // Basic info
        document.querySelectorAll('[id^="snippetProjectId"]').forEach(el => {
            el.textContent = project.id || 'N/A';
        });

        document.getElementById('gateName').textContent = project.name || 'Sem nome';
        document.getElementById('gateId').textContent = project.id || 'N/A';
        document.getElementById('gateCreated').textContent = project.createdAt ? formatDate(project.createdAt) : 'Data desconhecida';
        document.getElementById('apiEndpoint').textContent = `${window.location.origin}/api/${project.id || 'N/A'}`;
        document.getElementById('spreadsheetUrl').textContent = project.url || 'Sem URL';
        document.getElementById('gateLevel').textContent = project.level || 1;

        // Stats
        updateRequestStats(project);
        updateLevelProgress(project);
        updateGateStatus(project);
        updateAnimeEndpoint(project);
    }

    function updateRequestStats(project) {
        const requestsToday = project.requestsToday || 0;
        const dailyPercentage = Math.min(100, (requestsToday / REQUEST_LIMIT_PER_DAY) * 100);
        
        document.getElementById('dailyRequests').textContent = requestsToday;
        document.getElementById('totalRequests').textContent = project.totalRequests || 0;
        
        const progressBar = document.querySelector('.requests-progress');
        progressBar.style.width = `${dailyPercentage}%`;
        
        if (dailyPercentage >= 90) {
            progressBar.className = 'requests-progress bg-red-500 h-1 rounded-full';
        } else if (dailyPercentage >= 70) {
            progressBar.className = 'requests-progress bg-yellow-500 h-1 rounded-full';
        } else {
            progressBar.className = 'requests-progress bg-green-500 h-1 rounded-full';
        }
    }

    function updateLevelProgress(project) {
        const currentLevel = project.level || 1;
        const requestsInLevel = (project.totalRequests || 0) % 100;
        const progress = (requestsInLevel / 100) * 100;
        
        document.getElementById('levelProgressBar').style.width = `${progress}%`;
        document.getElementById('requestsToNextLevel').textContent = 100 - requestsInLevel;
    }

    function updateGateStatus(project) {
        const statusElement = document.getElementById('gateStatus');
        const status = project.status || 'active';
        
        if (status === 'active') {
            statusElement.innerHTML = '<i class="bi bi-check-circle-fill mr-2"></i> ACTIVE';
            statusElement.className = 'text-xl font-bold text-green-400 flex items-center';
        } else {
            statusElement.innerHTML = '<i class="bi bi-exclamation-circle-fill mr-2"></i> INACTIVE';
            statusElement.className = 'text-xl font-bold text-yellow-400 flex items-center';
        }
    }

    function updateAnimeEndpoint(project) {
        const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-4.mb-6');
        let endpointCard = document.getElementById('animeEndpointCard');
        
        if (!endpointCard) {
            endpointCard = document.createElement('div');
            endpointCard.id = 'animeEndpointCard';
            endpointCard.className = 'gate-card p-4';
            container.appendChild(endpointCard);
        }
        
        endpointCard.innerHTML = `
            <h3 class="text-sm font-medium text-gray-300 mb-2 tracking-wider flex items-center">
                <i class="bi bi-code-slash text-blue-400 mr-2"></i> ANIME API ENDPOINT
            </h3>
            <div class="flex items-center justify-between bg-gray-800 p-3 rounded border border-gray-700">
                <span id="animeEndpoint" class="text-xs text-white truncate font-mono">${window.location.origin}/${project.id}/animes</span>
                <button class="copy-button p-1 text-gray-400 hover:text-blue-400 transition">
                    <i class="bi bi-clipboard"></i>
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Access this URL for anime data in JSON format</p>
        `;
    }

    function initUsageChart(project) {
        const ctx = document.getElementById('usageChart').getContext('2d');
        const activityData = project.activityData || generateDefaultActivityData();
        const last7Days = getLastNDays(7);
        const chartData = last7Days.map(day => activityData[day] || 0);
        
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(day => formatChartDate(day)),
                datasets: [{
                    label: 'Requests',
                    data: chartData,
                    backgroundColor: 'rgba(58, 107, 255, 0.2)',
                    borderColor: 'rgba(58, 107, 255, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: getChartOptions()
        });
    }

    function setupTabs() {
        const tabLinks = document.querySelectorAll('.tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                tabLinks.forEach(tab => {
                    tab.classList.remove('border-blue-400', 'text-blue-400');
                    tab.classList.add('border-transparent', 'text-gray-400');
                });
                
                this.classList.add('border-blue-400', 'text-blue-400');
                this.classList.remove('border-transparent', 'text-gray-400');
                
                const tabId = this.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    function setupCopyButtons() {
        document.addEventListener('click', function(e) {
            if (e.target.closest('.copy-button') || e.target.closest('.copy-snippet')) {
                const button = e.target.closest('.copy-button, .copy-snippet');
                const text = button.previousElementSibling?.textContent || 
                             button.parentElement.previousElementSibling?.textContent;
                
                navigator.clipboard.writeText(text).then(() => {
                    const icon = button.innerHTML;
                    button.innerHTML = '<i class="bi bi-check2 text-green-400"></i>';
                    setTimeout(() => {
                        button.innerHTML = icon;
                    }, 2000);
                });
            }
        });
    }

    function setupTimeframeButtons() {
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.timeframe-btn').forEach(b => {
                    b.classList.remove('active', 'text-white');
                    b.classList.add('text-gray-400');
                });
                this.classList.add('active', 'text-white');
                this.classList.remove('text-gray-400');
                
                updateChart(this.getAttribute('data-days'));
            });
        });
    }

    function updateChart(days) {
        const lastNDays = getLastNDays(parseInt(days));
        const activityData = project.activityData || generateDefaultActivityData();
        const chartData = lastNDays.map(day => activityData[day] || 0);
        
        currentChart.data.labels = lastNDays.map(day => formatChartDate(day));
        currentChart.data.datasets[0].data = chartData;
        currentChart.update();
    }

    function simulateRequest() {
        const projects = getProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex >= 0) {
            const today = new Date().toISOString().split('T')[0];
            
            // Update project data
            projects[projectIndex].requestsToday = (projects[projectIndex].requestsToday || 0) + 1;
            projects[projectIndex].totalRequests = (projects[projectIndex].totalRequests || 0) + 1;
            
            // Initialize activity data if needed
            projects[projectIndex].activityData = projects[projectIndex].activityData || {};
            projects[projectIndex].activityData[today] = (projects[projectIndex].activityData[today] || 0) + 1;
            
            // Check for level up
            const currentLevel = projects[projectIndex].level || 1;
            if (projects[projectIndex].totalRequests >= currentLevel * 100) {
                projects[projectIndex].level = currentLevel + 1;
                showAlert(`Gate leveled up to level ${currentLevel + 1}!`, 'success');
            }
            
            // Save and update UI
            localStorage.setItem('shadowGateProjects4', JSON.stringify(projects));
            project = projects[projectIndex];
            updateProjectUI(project);
            updateChart('7'); // Refresh chart to show new data
        }
    }

    // Utility functions
    function getLastNDays(n) {
        const dates = [];
        for (let i = n-1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    }

    function formatChartDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function generateDefaultActivityData() {
        const data = {};
        const last90Days = getLastNDays(90);
        
        last90Days.forEach((day, index) => {
            const baseValue = Math.floor(Math.random() * 50) + 10;
            const trendValue = Math.floor(index * 0.7);
            data[day] = baseValue + trendValue;
        });
        
        return data;
    }

    function getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor: '#E2E8F0',
                    bodyColor: '#CBD5E1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    usePointStyle: true
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        };
    }

    function formatDate(dateString) {
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-US', options);
        } catch (e) {
            console.error('Date formatting error:', e);
            return 'Invalid date';
        }
    }

    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white font-semibold tracking-wider z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'danger' ? 'bg-red-600' :
            type === 'warning' ? 'bg-yellow-600' :
            'bg-blue-600'
        }`;
        alert.textContent = message;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    }
});
