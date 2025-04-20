// dashboard.js completo atualizado
document.addEventListener('DOMContentLoaded', function() {
    const REQUEST_LIMIT_PER_DAY = 1000;
    
    // Função para verificar e corrigir dados
    function getProjects() {
        try {
            const projects = JSON.parse(localStorage.getItem('shadowGateProjects4')) || [];
            if (!Array.isArray(projects)) throw new Error('Dados inválidos');
            return projects.filter(p => p && p.id);
        } catch (e) {
            console.error('Corrigindo dados corrompidos...', e);
            localStorage.setItem('shadowGateProjects4', JSON.stringify([]));
            return [];
        }
    }

    // Obter ID do projeto da URL
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('project');
        return projectId;
    }

    // Carregar projeto específico
    function loadProject(projectId) {
        if (!projectId) {
            console.error('Nenhum ID de projeto fornecido');
            return null;
        }

        const projects = getProjects();
        const project = projects.find(p => p.id === projectId);
        return project;
    }

    const projectId = getProjectIdFromUrl();
    const project = loadProject(projectId);
    
    if (!project) {
        showAlert('Projeto não encontrado! Redirecionando...', 'danger');
        setTimeout(() => window.location.href = 'home.html', 2000);
        return;
    }

    // Inicializa dailyRequests se não existir
    if (!project.dailyRequests) {
        project.dailyRequests = {};
        saveProject(project);
    }

    // Atualizar UI
    updateProjectUI(project);
    setupTabs();
    setupCopyButtons();
    setupTimeframeButtons();

    // Configurar botão de voltar
    document.getElementById('backButton').addEventListener('click', function() {
        window.location.href = 'home.html';
    });

    // Listener para mensagens do Service Worker
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'UPDATE_PROJECTS') {
            const updatedProject = event.data.payload.find(p => p.id === projectId);
            if (updatedProject) {
                updateProjectUI(updatedProject);
            }
        }
    });

    // Função para salvar projeto
    function saveProject(project) {
        const projects = getProjects();
        const index = projects.findIndex(p => p.id === project.id);
        if (index >= 0) {
            projects[index] = project;
        } else {
            projects.push(project);
        }
        localStorage.setItem('shadowGateProjects4', JSON.stringify(projects));
    }

    // Atualizar UI do projeto
    function updateProjectUI(project) {
        if (!project) return;

        // Informações básicas
        document.querySelectorAll('#snippetProjectId, #snippetProjectId2').forEach(el => {
            el.textContent = project.id || 'N/A';
        });

        document.getElementById('gateName').textContent = project.name || 'Sem nome';
        document.getElementById('gateId').textContent = project.id || 'N/A';
        document.getElementById('gateCreated').textContent = project.createdAt ? formatDate(project.createdAt) : 'Data desconhecida';
        document.getElementById('apiEndpoint').textContent = `${window.location.origin}/api/${project.id || 'N/A'}`;
        document.getElementById('spreadsheetUrl').textContent = project.url || 'Sem URL';
        document.getElementById('gateLevel').textContent = project.level || 1;

        // Atualizações dos sistemas
        updateDailyRequests(project);
        updateLevelProgress(project);
        updateGateStatus(project);
        initOrUpdateChart(project);
        updateAnimeEndpoint(project);
    }

    // Sistema de requests diários
    function updateDailyRequests(project) {
        const today = new Date().toISOString().split('T')[0];
        const requestsToday = project.dailyRequests[today] || 0;
        
        // Atualiza o contador
        document.getElementById('dailyRequests').textContent = requestsToday;
        
        // Atualiza a barra de progresso
        const progressPercentage = Math.min(100, (requestsToday / REQUEST_LIMIT_PER_DAY) * 100);
        const progressBar = document.querySelector('.gate-card:nth-child(2) .h-1.bg-blue-500');
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
            
            // Muda para vermelho se atingir o limite
            if (requestsToday >= REQUEST_LIMIT_PER_DAY) {
                progressBar.classList.replace('bg-blue-500', 'bg-red-500');
            } else {
                progressBar.classList.replace('bg-red-500', 'bg-blue-500');
            }
        }
    }

    // Sistema de gráfico
    function generateChartData(project, days = 7) {
        const dailyRequests = project.dailyRequests || {};
        const dates = [];
        
        // Gera os dias solicitados
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        return {
            labels: dates.map(date => {
                const d = new Date(date);
                return `${d.getDate()}/${d.getMonth() + 1}`;
            }),
            datasets: [{
                label: 'Requests',
                data: dates.map(date => dailyRequests[date] || 0),
                backgroundColor: 'rgba(58, 107, 255, 0.2)',
                borderColor: 'rgba(58, 107, 255, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };
    }

    function initOrUpdateChart(project) {
        const ctx = document.getElementById('usageChart').getContext('2d');
        const chartData = generateChartData(project);
        
        if (window.usageChart) {
            window.usageChart.data.labels = chartData.labels;
            window.usageChart.data.datasets[0].data = chartData.datasets[0].data;
            window.usageChart.update();
        } else {
            window.usageChart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
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
                }
            });
        }
    }

    function updateChartTimeframe(days) {
        const project = loadProject(projectId);
        if (!project) return;
        
        if (window.usageChart) {
            const chartData = generateChartData(project, days);
            window.usageChart.data.labels = chartData.labels;
            window.usageChart.data.datasets[0].data = chartData.datasets[0].data;
            window.usageChart.update();
        }
    }

    // Função para simular request (para teste)
    function simulateRequest() {
        const project = loadProject(projectId);
        if (!project) return;
        
        const today = new Date().toISOString().split('T')[0];
        
        // Inicializa dailyRequests se não existir
        if (!project.dailyRequests) {
            project.dailyRequests = {};
        }
        
        // Atualiza os contadores
        project.requestsToday = (project.requestsToday || 0) + 1;
        project.totalRequests = (project.totalRequests || 0) + 1;
        project.dailyRequests[today] = (project.dailyRequests[today] || 0) + 1;
        
        // Verifica level up
        const currentLevel = project.level || 1;
        if (project.totalRequests >= currentLevel * 100) {
            project.level = currentLevel + 1;
            showAlert(`Gate leveled up to level ${currentLevel + 1}!`, 'success');
        }
        
        // Salva e atualiza a UI
        saveProject(project);
        updateProjectUI(project);
    }

    // Configurar botões de timeframe
    function setupTimeframeButtons() {
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.timeframe-btn').forEach(b => {
                    b.classList.remove('active', 'text-white');
                    b.classList.add('text-gray-400');
                });
                this.classList.add('active', 'text-white');
                this.classList.remove('text-gray-400');
                
                updateChartTimeframe(parseInt(this.getAttribute('data-days')));
            });
        });
    }

    // Funções auxiliares existentes (mantidas iguais)
    function updateLevelProgress(project) {
        const currentLevel = project.level || 1;
        const requestsNeeded = currentLevel * 100;
        const progress = ((project.totalRequests || 0) % 100) / 100 * 100;
        
        document.getElementById('levelProgressBar').style.width = `${progress}%`;
        document.getElementById('requestsToNextLevel').textContent = 
            Math.max(0, requestsNeeded - (project.totalRequests || 0));
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
        document.querySelectorAll('.copy-button').forEach(button => {
            button.addEventListener('click', function() {
                const text = this.previousElementSibling.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    const icon = this.innerHTML;
                    this.innerHTML = '<i class="bi bi-check2 text-green-400"></i>';
                    setTimeout(() => {
                        this.innerHTML = icon;
                    }, 2000);
                });
            });
        });
    }

    function formatDate(dateString) {
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-US', options);
        } catch (e) {
            console.error('Erro ao formatar data:', e);
            return 'Data inválida';
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

    // Expor simulateRequest para o HTML
    window.simulateRequest = simulateRequest;
});
