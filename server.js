const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para /:id/animes
app.get('/:id/animes', (req, res) => {
    const animeData = generateAnimeData(req.params.id);
    res.json(animeData);
});

// Rota fallback para o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function generateAnimeData(number) {
    const animeTitles = [
        "Attack on Titan", "Demon Slayer", "Jujutsu Kaisen",
        "My Hero Academia", "One Piece", "Naruto",
        "Death Note", "Fullmetal Alchemist: Brotherhood",
        "Hunter x Hunter", "Steins;Gate"
    ];
    
    const count = number % 5 + 1;
    const animes = [];
    
    for (let i = 0; i < count; i++) {
        const randomIndex = (number.toString().charCodeAt(i % number.toString().length) + i) % animeTitles.length;
        animes.push({
            id: i + 1,
            title: animeTitles[randomIndex],
            year: 2010 + (number.toString().charCodeAt(i % number.toString().length) % 15,
            episodes: 12 + (number.toString().charCodeAt(i % number.toString().length) % 50),
            rating: (3 + (number.toString().charCodeAt(i % number.toString().length) % 20) / 10).toFixed(1)
        });
    }
    
    return {
        requestId: number,
        timestamp: new Date().toISOString(),
        animes: animes,
        message: `Você solicitou dados de animes com o ID ${number}`
    };
}

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
