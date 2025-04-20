const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Adicione esta linha no topo
const path = require('path');
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

// Rota para /:id/filmes (com integração Xtream)
app.get('/:id/filmes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'filmes');

        // Buscar dados da API Xtream
        const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
            throw new Error('Falha ao buscar dados de filmes');
        }

        const filmesData = await apiResponse.json();

        // Adicionar URL do player ofuscada
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
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Rota para streaming de filmes
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

        // Configurar headers para streaming
        res.set({
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-store',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked'
        });

        // Pipe do stream
        streamResponse.body.pipe(res);

    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Stream error'
        });
    }
});

// Rota padrão para o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Funções auxiliares (generateAnimeData e incrementRequestCount permanecem iguais)
// ... (mantenha as mesmas funções do código anterior)

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
