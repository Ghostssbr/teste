const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para /:id/animes
app.get('/:id/animes', (req, res) => {
    try {
        const animeData = generateAnimeData(req.params.id);
        res.json(animeData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Rota fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para gerar dados de anime
function generateAnimeData(id) {
    const animeTitles = [
        "Attack on Titan", "Demon Slayer", "Jujutsu Kaisen",
        "My Hero Academia", "One Piece", "Naruto",
        "Death Note", "Fullmetal Alchemist: Brotherhood",
        "Hunter x Hunter", "Steins;Gate"
    ];

    // Convertendo o ID para string para manipulação segura
    const idStr = id.toString();
    const count = parseInt(idStr.charAt(idStr.length - 1)) || 1;
    const animes = [];

    for (let i = 0; i < Math.min(count, 5); i++) {
        const charCode = idStr.charCodeAt(i % idStr.length);
        const randomIndex = charCode % animeTitles.length;
        
        animes.push({
            id: i + 1,
            title: animeTitles[randomIndex],
            year: 2010 + (charCode % 15),
            episodes: 12 + (charCode % 50),
            rating: (3 + (charCode % 20) / 10).toFixed(1)
        });
    }

    return {
        requestId: id,
        timestamp: new Date().toISOString(),
        animes: animes,
        message: `Você solicitou dados de animes com o ID ${id}`
    };
}

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
