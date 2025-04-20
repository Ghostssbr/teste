const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware para JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar projeto
async function verifyProject(req, res, next) {
    const projectId = req.params.id;
    
    try {
        const { data: project, error } = await supabase
            .from('project_tokens')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (error || !project) {
            return res.status(404).json({ 
                status: 'error',
                error: 'Project not found',
                message: `O projeto com ID ${projectId} não existe no banco de dados`
            });
        }

        req.project = project;
        next();
    } catch (err) {
        console.error('Error verifying project:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error',
            details: err.message 
        });
    }
}

// Rota para /:id/animes
app.get('/:id/animes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'animes');
        
        res.json({
            status: 'success',
            projectId,
            timestamp: new Date().toISOString(),
            data: generateAnimeData(projectId)
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
});

// Nova rota para /:id/filmes
app.get('/:id/filmes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'filmes');
        
        res.json({
            status: 'success',
            projectId,
            timestamp: new Date().toISOString(),
            data: generateFilmesData(projectId)
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
});

// Rota padrão para o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para gerar dados de anime
function generateAnimeData(projectId) {
    const baseAnimes = [
        { id: 1, title: "Attack on Titan", episodes: 75, year: 2013 },
        { id: 2, title: "Demon Slayer", episodes: 44, year: 2019 },
        { id: 3, title: "Jujutsu Kaisen", episodes: 24, year: 2020 }
    ];

    const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    return baseAnimes.map(anime => ({
        ...anime,
        episodes: anime.episodes + (hash % 5),
        year: anime.year + (hash % 3),
        rating: (3.5 + (hash % 5 * 0.3)).toFixed(1),
        projectSpecific: `custom-${projectId.slice(0, 3)}-${anime.id}`
    }));
}

// Função para gerar dados de filmes
function generateFilmesData(projectId) {
    const baseFilmes = [
        { id: 1, title: "O Poderoso Chefão", year: 1972, duration: 175 },
        { id: 2, title: "Interestelar", year: 2014, duration: 169 },
        { id: 3, title: "Parasita", year: 2019, duration: 132 }
    ];

    const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    return baseFilmes.map(filme => ({
        ...filme,
        duration: filme.duration + (hash % 20),
        year: filme.year + (hash % 3),
        rating: (4.0 + (hash % 5 * 0.2)).toFixed(1),
        projectSpecific: `movie-${projectId.slice(-3)}-${filme.id}`
    }));
}

// Função para incrementar contador no Supabase
async function incrementRequestCount(projectId, endpointType) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: currentData } = await supabase
            .from('project_requests')
            .select('*')
            .eq('project_id', projectId)
            .single();

        const requestsToday = (currentData?.requests_today || 0) + 1;
        const totalRequests = (currentData?.total_requests || 0) + 1;
        const dailyRequests = {
            ...(currentData?.daily_requests || {}),
            [today]: (currentData?.daily_requests?.[today] || 0) + 1
        };
        
        let level = currentData?.level || 1;
        if (totalRequests >= level * 100) {
            level += 1;
        }

        await supabase
            .from('project_requests')
            .upsert({
                project_id: projectId,
                requests_today: requestsToday,
                total_requests: totalRequests,
                last_request_date: today,
                daily_requests: dailyRequests,
                level: level,
                updated_at: new Date().toISOString(),
                last_endpoint: endpointType
            });
    } catch (error) {
        console.error('Error updating request count:', error);
    }
}

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
