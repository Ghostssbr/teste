// dashboard.js atualizado
document.addEventListener('DOMContentLoaded', function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter ID do projeto da URL
    const getProjectIdFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('project');
    };

    // Carregar projeto do Supabase
    const loadProject = async (projectId) => {
        try {
            const { data, error } = await supabase
                .from('project_requests')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao carregar projeto:', error);
            showAlert('Erro ao carregar dados do projeto', 'danger');
            return null;
        }
    };

    // Atualizar UI
    const updateProjectUI = async (project) => {
        if (!project) return;

        // Informações básicas
        document.getElementById('gateName').textContent = project.name || 'Sem nome';
        document.getElementById('gateId').textContent = project.id || 'N/A';
        document.getElementById('dailyRequests').textContent = project.requests_today || 0;
        document.getElementById('gateLevel').textContent = project.level || 1;

        // Atualizar endpoint de animes
        updateAnimeEndpoint(project);
        
        // Atualizar gráfico
        initOrUpdateChart(project);
        
        // Atualizar progresso
        updateLevelProgress(project);
    };

    // Endpoint de animes
    const updateAnimeEndpoint = (project) => {
        const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-4.mb-6');
        if (!container) return;

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
                <span class="text-xs text-white truncate font-mono">
                    ${window.location.origin}/${project.id}/animes
                </span>
                <button class="copy-button p-1 text-gray-400 hover:text-blue-400 transition">
                    <i class="bi bi-clipboard"></i>
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Access this URL for anime data in JSON format</p>
        `;
    };

    // Sistema de gráfico
    const generateChartData = (project) => {
        if (!project.daily_requests) return null;

        const dates = Object.keys(project.daily_requests).sort();
        const last7Days = dates.slice(-7);

        return {
            labels: last7Days.map(date => {
                const [year, month, day] = date.split('-');
                return `${day}/${month}`;
            }),
            datasets: [{
                label: 'Requests',
                data: last7Days.map(date => project.daily_requests[date]),
                backgroundColor: 'rgba(58, 107, 255, 0.2)',
                borderColor: 'rgba(58, 107, 255, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };
    };

    const initOrUpdateChart = (project) => {
        const ctx = document.getElementById('usageChart')?.getContext('2d');
        if (!ctx) return;

        const chartData = generateChartData(project);
        if (!chartData) return;

        if (window.usageChart) {
            window.usageChart.destroy();
        }

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
    };

    // Atualizar progresso do nível
    const updateLevelProgress = (project) => {
        const currentLevel = project.level || 1;
        const requestsNeeded = currentLevel * 100;
        const progress = ((project.total_requests || 0) % 100) / 100 * 100;
        
        if (document.getElementById('levelProgressBar')) {
            document.getElementById('levelProgressBar').style.width = `${progress}%`;
        }
        
        if (document.getElementById('requestsToNextLevel')) {
            document.getElementById('requestsToNextLevel').textContent = 
                Math.max(0, requestsNeeded - (project.total_requests || 0));
        }
    };

    // Inicialização
    const init = async () => {
        const projectId = getProjectIdFromUrl();
        if (!projectId) {
            showAlert('ID do projeto inválido', 'danger');
            return;
        }

        const project = await loadProject(projectId);
        if (!project) {
            showAlert('Projeto não encontrado', 'danger');
            setTimeout(() => window.location.href = 'home.html', 2000);
            return;
        }

        updateProjectUI(project);
        setupTabs();
        setupCopyButtons();
    };

    // Configurações iniciais
    const setupTabs = () => {
        document.querySelectorAll('.tab-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.tab-link').forEach(tab => {
                    tab.classList.remove('border-blue-400', 'text-blue-400');
                    tab.classList.add('border-transparent', 'text-gray-400');
                });
                this.classList.add('border-blue-400', 'text-blue-400');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(this.dataset.tab).classList.add('active');
            });
        });
    };

    const setupCopyButtons = () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.copy-button')) {
                const text = e.target.closest('.copy-button').previousElementSibling?.textContent;
                if (text) {
                    navigator.clipboard.writeText(text);
                    showAlert('Copied to clipboard!', 'success');
                }
            }
        });
    };

    const showAlert = (message, type) => {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white font-semibold tracking-wider z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'danger' ? 'bg-red-600' : 'bg-blue-600'
        }`;
        alert.textContent = message;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    };

    // Iniciar
    init();
});
