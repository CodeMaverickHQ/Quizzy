import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://quizzy.operdesk.com', 'https://quizzy.operdesk.com'],
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

interface Player {
  id: string;
  username: string;
  score: number;
}

interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
}

const activeGames = new Map<string, {
  players: Map<string, Player>;
  currentQuestion: number;
  quiz: Quiz;
  answers: Map<string, number>;
  timer?: NodeJS.Timeout;
}>();

function startQuestionTimer(gameId: string) {
  const game = activeGames.get(gameId);
  if (!game) return;
  const question = game.quiz.questions[game.currentQuestion];
  if (!question) return;
  // Clear any existing timer
  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    // Reveal answer
    const correctPlayers = Array.from(game.answers.entries())
      .filter(([_, answer]) => answer === question.correctAnswer)
      .map(([playerId]) => playerId);
    io.to(gameId).emit('revealAnswer', {
      correctAnswer: question.correctAnswer,
      correctPlayers,
      updatedPlayers: Array.from(game.players.values()),
    });
    game.answers.clear();
    // Move to next question after 3 seconds
    setTimeout(() => {
      game.currentQuestion++;
      if (game.currentQuestion >= game.quiz.questions.length) {
        io.to(gameId).emit('gameOver', Array.from(game.players.values()));
        return;
      }
      const nextQuestion = game.quiz.questions[game.currentQuestion];
      io.to(gameId).emit('newQuestion', {
        question: nextQuestion,
        timeLimit: nextQuestion.timeLimit
      });
      startQuestionTimer(gameId);
    }, 3000);
  }, question.timeLimit * 1000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', (quiz: Quiz) => {
    const gameId = Math.random().toString(36).substring(2, 8);
    activeGames.set(gameId, {
      players: new Map(),
      currentQuestion: 0,
      quiz,
      answers: new Map(),
    });
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  socket.on('joinGame', ({ gameId, username }) => {
    const game = activeGames.get(gameId);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    const player: Player = {
      id: socket.id,
      username,
      score: 0
    };

    game.players.set(socket.id, player);
    socket.join(gameId);
    
    io.to(gameId).emit('playerJoined', {
      id: socket.id,
      username,
      score: 0
    });
  });

  socket.on('submitAnswer', ({ gameId, answerIndex }) => {
    const game = activeGames.get(gameId);
    if (!game) return;
    const player = game.players.get(socket.id);
    if (!player) return;
    if (game.answers.has(socket.id)) return;
    game.answers.set(socket.id, answerIndex);
    const currentQuestion = game.quiz.questions[game.currentQuestion];
    if (answerIndex === currentQuestion.correctAnswer) {
      player.score += 1000;
      game.players.set(socket.id, player);
      io.to(gameId).emit('scoreUpdate', {
        playerId: socket.id,
        score: player.score
      });
    }
  });

  socket.on('nextQuestion', (gameId) => {
    const game = activeGames.get(gameId);
    if (!game) return;
    // Reveal answer for the previous question (if not the first question)
    if (game.currentQuestion < game.quiz.questions.length) {
      const currentQuestion = game.quiz.questions[game.currentQuestion];
      const correctPlayers = Array.from(game.answers.entries())
        .filter(([_, answer]) => answer === currentQuestion.correctAnswer)
        .map(([playerId]) => playerId);
      io.to(gameId).emit('revealAnswer', {
        correctAnswer: currentQuestion.correctAnswer,
        correctPlayers,
        updatedPlayers: Array.from(game.players.values()),
      });
      game.answers.clear();
    }
    // Move to next question
    game.currentQuestion++;
    if (game.currentQuestion >= game.quiz.questions.length) {
      io.to(gameId).emit('gameOver', Array.from(game.players.values()));
      return;
    }
    const question = game.quiz.questions[game.currentQuestion];
    io.to(gameId).emit('newQuestion', {
      question,
      timeLimit: question.timeLimit
    });
    startQuestionTimer(gameId);
  });

  socket.on('startCountdown', (gameId) => {
    const game = activeGames.get(gameId);
    if (!game) return;
    io.to(gameId).emit('startCountdown');
    // After countdown, start first question and timer
    setTimeout(() => {
      if (game.currentQuestion >= game.quiz.questions.length) return;
      const question = game.quiz.questions[game.currentQuestion];
      io.to(gameId).emit('newQuestion', {
        question,
        timeLimit: question.timeLimit
      });
      startQuestionTimer(gameId);
    }, 5000);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeGames.forEach((game, gameId) => {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(gameId).emit('playerLeft', socket.id);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 