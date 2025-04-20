const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração da API de filmes
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Middleware
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
                message: `Project ID ${projectId} not found in database`
            });
        }

        req.project = project;
        next();
    } catch (err) {
        console.error('Error verifying project:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
}

// Endpoint /:id/animes
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

// Endpoint /:id/filmes
app.get('/:id/filmes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'filmes');

        const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
            throw new Error('Failed to fetch movies data');
        }

        const filmesData = await apiResponse.json();

        const filmesComPlayer = filmesData.map(filme => ({
            ...filme,
            player: `${req.protocol}://${req.get('host')}/${projectId}/stream/${filme.stream_id}.mp4`
        }));

        res.json({
            status: 'success',
            projectId,
            timestamp: new Date().toISOString(),
            data: filmesComPlayer
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
});

// Endpoint de streaming
app.get('/:id/stream/:streamId', verifyProject, async (req, res) => {
    try {
        const streamId = req.params.streamId;
        const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
        
        const streamResponse = await fetch(realStreamUrl);
        
        if (!streamResponse.ok) {
            return res.status(404).json({ 
                status: 'error',
                error: 'Stream not found'
            });
        }

        res.set({
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-store'
        });

        streamResponse.body.pipe(res);

    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Stream error'
        });
    }
});

// Funções auxiliares
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

async function incrementRequestCount(projectId, endpointType) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: currentData } = await supabase
            .from('project_requests')
            .select('*')
            .eq('project_id', projectId)
            .single();

        const updateData = {
            requests_today: (currentData?.requests_today || 0) + 1,
            total_requests: (currentData?.total_requests || 0) + 1,
            last_request_date: today,
            daily_requests: {
                ...(currentData?.daily_requests || {}),
                [today]: (currentData?.daily_requests?.[today] || 0) + 1
            },
            updated_at: new Date().toISOString(),
            last_endpoint: endpointType
        };

        if (updateData.total_requests >= (currentData?.level || 1) * 100) {
            updateData.level = (currentData?.level || 1) + 1;
        }

        await supabase
            .from('project_requests')
            .upsert(updateData);

    } catch (error) {
        console.error('Error updating request count:', error);
    }
}

// Rota padrão para o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
