document.addEventListener('DOMContentLoaded', function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Elementos do DOM
    const elements = {
        gateName: document.getElementById('gateName'),
        gateId: document.getElementById('gateId'),
        gateCreated: document.getElementById('gateCreated'),
        apiEndpoint: document.getElementById('apiEndpoint'),
        spreadsheetUrl: document.getElementById('spreadsheetUrl'),
        dailyRequests: document.getElementById('dailyRequests'),
        gateLevel: document.getElementById('gateLevel'),
        levelProgressBar: document.getElementById('levelProgressBar'),
        requestsToNextLevel: document.getElementById('requestsToNextLevel'),
        gateStatus: document.getElementById('gateStatus'),
        usageChart: document.getElementById('usageChart')
    };

    // Obter ID do projeto da URL
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('project');
    }

    // Carregar projeto do Supabase
    async function loadProject() {
        const projectId = getProjectIdFromUrl();
        if (!projectId) return null;

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
    }

    // Atualizar interface
    async function updateProjectUI(project) {
        if (!project) return;

        // Informações básicas
        elements.gateName.textContent = project.name || 'Sem nome';
        elements.gateId.textContent = project.id || 'N/A';
        elements.dailyRequests.textContent = project.requests_today || 0;
        elements.gateLevel.textContent = project.level || 1;
        elements.apiEndpoint.textContent = `${window.location.origin}/api/${project.id}`;
        
        // Endpoint de animes
        updateAnimeEndpoint(project.id);
        
        // Progresso do nível
        updateLevelProgress(project);
        
        // Gráfico
        updateChart(project);
    }

    // Atualizar endpoint de animes
    function updateAnimeEndpoint(projectId) {
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
                    ${window.location.origin}/${projectId}/animes
                </span>
                <button class="copy-button p-1 text-gray-400 hover:text-blue-400 transition">
                    <i class="bi bi-clipboard"></i>
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Access this URL for anime data in JSON format</p>
        `;
    }

    // Atualizar gráfico com dados reais
    function updateChart(project) {
        if (!project?.daily_requests) return;

        const ctx = elements.usageChart.getContext('2d');
        const dailyRequests = project.daily_requests;
        const dates = Object.keys(dailyRequests).sort().slice(-7);
        
        if (window.usageChart) {
            window.usageChart.destroy();
        }

        window.usageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => {
                    const [y, m, d] = date.split('-');
                    return `${d}/${m}`;
                }),
                datasets: [{
                    label: 'Requests',
                    data: dates.map(date => dailyRequests[date]),
                    backgroundColor: 'rgba(58, 107, 255, 0.2)',
                    borderColor: 'rgba(58, 107, 255, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
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

    // Atualizar progresso do nível
    function updateLevelProgress(project) {
        const currentLevel = project.level || 1;
        const requestsNeeded = currentLevel * 100;
        const progress = ((project.total_requests || 0) % 100);
        
        elements.levelProgressBar.style.width = `${progress}%`;
        elements.requestsToNextLevel.textContent = 
            Math.max(0, requestsNeeded - (project.total_requests || 0));
    }

    // Configurações iniciais
    async function init() {
        const project = await loadProject();
        if (!project) {
            showAlert('Projeto não encontrado! Redirecionando...', 'danger');
            setTimeout(() => window.location.href = 'home.html', 2000);
            return;
        }

        updateProjectUI(project);
        setupCopyButtons();
        setupTabs();
    }

    function setupTabs() {
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
    }

    function setupCopyButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.copy-button')) {
                const text = e.target.closest('.copy-button').previousElementSibling?.textContent;
                if (text) {
                    navigator.clipboard.writeText(text);
                    showAlert('Endpoint copiado!', 'success');
                }
            }
        });
    }

    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 p-4 rounded-lg ${
            type === 'danger' ? 'bg-red-600' : 
            type === 'success' ? 'bg-green-600' : 'bg-blue-600'
        } text-white font-semibold tracking-wider z-50`;
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    // Inicialização
    document.getElementById('backButton').addEventListener('click', () => {
        window.location.href = 'home.html';
    });

    init();
});
