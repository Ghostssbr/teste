const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Supabase Configuration
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Xtream API Configuration
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sistema de Detecção de Requisições
const requestDetection = {
  monitoredPaths: ['/animes', '/filmes'],
  suspiciousThreshold: 10,
  timeframeMinutes: 1,
  requestLog: new Map(),
  blockedIPs: new Set(),
  
  checkRequest: function(req) {
    const path = req.path.toLowerCase();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    
    if (this.blockedIPs.has(clientIp)) {
      return { blocked: true, reason: "IP bloqueado" };
    }
    
    if (this.monitoredPaths.some(p => path.includes(p))) {
      if (!this.requestLog.has(clientIp)) {
        this.requestLog.set(clientIp, []);
      }
      
      const requests = this.requestLog.get(clientIp);
      requests.push(now);
      
      const cutoff = now - (this.timeframeMinutes * 60 * 1000);
      const recentRequests = requests.filter(t => t > cutoff);
      this.requestLog.set(clientIp, recentRequests);
      
      if (recentRequests.length > this.suspiciousThreshold) {
        this.blockedIPs.add(clientIp);
        return { blocked: true, reason: "Muitas requisições em curto período" };
      }
      
      return { monitored: true, count: recentRequests.length };
    }
    
    return { monitored: false };
  },
  
  cleanup: function() {
    const now = Date.now();
    const cutoff = now - (this.timeframeMinutes * 60 * 1000);
    
    for (const [ip, requests] of this.requestLog.entries()) {
      const recentRequests = requests.filter(t => t > cutoff);
      if (recentRequests.length === 0) {
        this.requestLog.delete(ip);
      } else {
        this.requestLog.set(ip, recentRequests);
      }
    }
  }
};

setInterval(() => requestDetection.cleanup(), 60000);

// Middleware de Detecção
app.use((req, res, next) => {
  const detectionResult = requestDetection.checkRequest(req);
  
  if (detectionResult.blocked) {
    console.warn(`[BLOCKED] IP ${req.ip} blocked: ${detectionResult.reason}`);
    return res.status(429).json({ 
      status: 'error',
      error: 'Muitas requisições. Tente novamente mais tarde.'
    });
  }
  
  if (detectionResult.monitored) {
    console.log(`[MONITORED] Request to ${req.path} from ${req.ip} (${detectionResult.count} requests)`);
    
    supabase.from('request_logs').insert({
      ip_address: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
      user_agent: req.headers['user-agent']
    }).then(({ error }) => {
      if (error) console.error('Log error:', error);
    });
  }
  
  next();
});

// Project Verification Middleware
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
        error: 'Project not found'
      });
    }

    req.project = project;
    next();
  } catch (err) {
    console.error('Project verification error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error'
    });
  }
}

// Movies Endpoint
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

    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/${projectId}/stream/${filme.stream_id}.mp4`,
      stream_icon: `${req.protocol}://${req.get('host')}/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      data: filmesComLinks
    });

  } catch (err) {
    console.error('Movies endpoint error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error'
    });
  }
});

// Stream Endpoint
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

// Icon Endpoint
app.get('/:id/icon/:streamId', verifyProject, async (req, res) => {
  try {
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#ddd"/>
      <text x="50" y="50" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">Icon</text>
    </svg>`;
    
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    });
    
    res.send(svgIcon);
  } catch (err) {
    console.error('Icon handling error:', err);
    res.status(500).send('Icon error');
  }
});

// Anime Endpoint
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
    console.error('Anime endpoint error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error'
    });
  }
});

// Helper Functions
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
    
    // Primeiro busca os dados atuais
    const { data: currentData, error: fetchError } = await supabase
      .from('project_requests')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Ignora erro de "nenhum resultado"
      throw fetchError;
    }

    // Prepara os dados para atualização
    const updateData = {
      project_id: projectId,
      requests_today: ((currentData?.requests_today) || 0) + 1,
      total_requests: ((currentData?.total_requests) || 0) + 1,
      last_request_date: today,
      daily_requests: { ...currentData?.daily_requests },
      updated_at: new Date().toISOString(),
      last_endpoint: endpointType
    };

    // Atualiza o contador diário
    if (!updateData.daily_requests[today]) {
      updateData.daily_requests[today] = 1;
    } else {
      updateData.daily_requests[today] += 1;
    }

    // Verifica e atualiza o nível
    const currentLevel = currentData?.level || 1;
    if (updateData.total_requests >= currentLevel * 100) {
      updateData.level = currentLevel + 1;
    } else {
      updateData.level = currentLevel;
    }

    // Faz o upsert (insert ou update)
    const { error } = await supabase
      .from('project_requests')
      .upsert(updateData);

    if (error) throw error;

  } catch (error) {
    console.error('Request count error:', error);
  }
}

// Frontend Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
