import { useState, useEffect, useRef } from 'react';
import { Box, VStack, Heading, Text, Input, Button, Container, Grid, GridItem, useToast, HStack, IconButton } from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { io, Socket } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

interface Player {
  id: string;
  username: string;
  score: number;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
}

function CreateGame({ onGameCreated }: { onGameCreated: (socket: Socket, gameId: string) => void }) {
  const [questions, setQuestions] = useState<Partial<Question>[]>([{
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    timeLimit: 30,
  }]);
  const [createdGameId, setCreatedGameId] = useState<string>('');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  const handleQuestionChange = (idx: number, field: string, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const handleOptionChange = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options?.map((o, oi) => oi === optIdx ? value : o) } : q));
  };
  const addQuestion = () => {
    setQuestions(prev => ([...prev, { text: '', options: ['', '', '', ''], correctAnswer: 0, timeLimit: 30 }]));
  };
  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };
  const createGame = () => {
    let quizQuestions;
    if (jsonInput.trim()) {
      try {
        const parsed = JSON.parse(jsonInput);
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
        quizQuestions = parsed.map((q, idx) => ({
          id: (idx + 1).toString(),
          text: q.text || '',
          options: q.options || ['', '', '', ''],
          correctAnswer: q.correctAnswer ?? 0,
          timeLimit: q.timeLimit ?? 30,
        }));
        setJsonError('');
      } catch (e: any) {
        setJsonError(e.message || 'Invalid JSON');
        toast({
          title: 'Invalid JSON',
          description: e.message || 'Please check your JSON format.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        return;
      }
    } else {
      quizQuestions = questions.map((q, idx) => ({
        id: (idx + 1).toString(),
        text: q.text || '',
        options: q.options || ['', '', '', ''],
        correctAnswer: q.correctAnswer ?? 0,
        timeLimit: q.timeLimit ?? 30,
      }));
    }
    const newSocket = io('http://srv-captain--quizzy-backend');
    const quiz = {
      id: '1',
      title: 'Custom Quiz',
      questions: quizQuestions
    };
    newSocket.emit('createGame', quiz);
    newSocket.on('gameCreated', (id: string) => {
      setCreatedGameId(id);
      toast({
        title: 'Game Created!',
        description: `Game ID: ${id}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onGameCreated(newSocket, id);
      navigate('/');
    });
  };
  return (
    <Box w="100%" maxW="600px" p={6} borderRadius="lg" boxShadow="lg" bg="white" mx="auto">
      <VStack gap={4} align="stretch">
        <Heading size="md" mb={2}>Create Game</Heading>
        <Text>Paste questions as JSON (optional):</Text>
        <Input
          as="textarea"
          rows={8}
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          placeholder='[
  {"text": "What is 2+2?", "options": ["1","2","3","4"], "correctAnswer": 3, "timeLimit": 20}
]'
        />
        {jsonError && <Text color="red.500">{jsonError}</Text>}
        <Text>Or use the form below:</Text>
        {questions.map((q, qIdx) => (
          <Box key={qIdx} p={3} borderRadius="md" borderWidth={1} borderColor="gray.200" bg="white">
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="bold">Question {qIdx + 1}</Text>
              <IconButton
                aria-label="Remove question"
                icon={<DeleteIcon />}
                size="sm"
                colorScheme="red"
                onClick={() => removeQuestion(qIdx)}
                isDisabled={questions.length === 1}
              />
            </HStack>
            <Input
              placeholder="Question text"
              value={q.text || ''}
              onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)}
              mb={2}
            />
            <VStack gap={2} align="stretch">
              {q.options?.map((opt, optIdx) => (
                <Input
                  key={optIdx}
                  placeholder={`Option ${optIdx + 1}`}
                  value={opt}
                  onChange={e => handleOptionChange(qIdx, optIdx, e.target.value)}
                />
              ))}
            </VStack>
            <HStack mt={2}>
              <Text>Correct Answer:</Text>
              <Input
                type="number"
                min={0}
                max={3}
                width="60px"
                value={q.correctAnswer ?? 0}
                onChange={e => handleQuestionChange(qIdx, 'correctAnswer', Number(e.target.value))}
              />
              <Text>Time Limit (sec):</Text>
              <Input
                type="number"
                min={5}
                max={120}
                width="80px"
                value={q.timeLimit ?? 30}
                onChange={e => handleQuestionChange(qIdx, 'timeLimit', Number(e.target.value))}
              />
            </HStack>
          </Box>
        ))}
        <Button leftIcon={<AddIcon />} onClick={addQuestion} colorScheme="purple" variant="outline">
          Add Question
        </Button>
        <Button colorScheme="green" onClick={createGame} w="100%" size="lg" mt={4}>
          Create Game
        </Button>
        {createdGameId && (
          <Box mt={2} p={2} borderRadius="md" borderWidth={1} borderColor="purple.200" bg="purple.50">
            <Text fontWeight="bold" color="purple.700">Game ID: {createdGameId}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
}

function MainApp({ socket, gameId, isHost, setSocket, setGameId }: { socket: Socket | null; gameId: string; isHost: boolean; setSocket: React.Dispatch<React.SetStateAction<Socket | null>>; setGameId: React.Dispatch<React.SetStateAction<string>> }) {
  const [username, setUsername] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [correctPlayers, setCorrectPlayers] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const prevScores = useRef<{ [id: string]: number }>({});
  const toast = useToast();

  useEffect(() => {
    if (socket) {
      socket.on('playerJoined', (player: Player) => {
        setPlayers(prev => [...prev, player]);
      });
      socket.on('playerLeft', (playerId: string) => {
        setPlayers(prev => prev.filter(p => p.id !== playerId));
      });
      socket.on('scoreUpdate', ({ playerId, score }: { playerId: string; score: number }) => {
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, score } : p));
      });
      socket.on('newQuestion', ({ question, timeLimit }: { question: Question; timeLimit: number }) => {
        setCurrentQuestion(question);
        setTimeLeft(timeLimit);
        setGameStarted(true);
        setHasAnswered(false);
        setShowAnswer(false);
        setCorrectAnswerIndex(null);
        setCorrectPlayers([]);
      });
      socket.on('revealAnswer', ({ correctAnswer, correctPlayers, updatedPlayers }: { correctAnswer: number, correctPlayers: string[], updatedPlayers: Player[] }) => {
        setShowAnswer(true);
        setCorrectAnswerIndex(correctAnswer);
        setCorrectPlayers(correctPlayers);
        setLeaderboard(updatedPlayers.sort((a, b) => b.score - a.score));
        prevScores.current = Object.fromEntries(updatedPlayers.map(p => [p.id, p.score]));
      });
      socket.on('gameOver', (finalPlayers: Player[]) => {
        setPlayers(finalPlayers);
        setGameStarted(false);
        toast({
          title: 'Game Over!',
          description: 'Final scores have been calculated.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      });
      socket.on('startCountdown', () => {
        setShowCountdown(true);
        setCountdown(5);
        let count = 5;
        const interval = setInterval(() => {
          count--;
          setCountdown(count);
          if (count === 0) {
            clearInterval(interval);
            setShowCountdown(false);
            if (isHost) {
              socket.emit('nextQuestion', gameId);
            }
          }
        }, 1000);
      });
      return () => {
        socket.off('playerJoined');
        socket.off('playerLeft');
        socket.off('scoreUpdate');
        socket.off('newQuestion');
        socket.off('revealAnswer');
        socket.off('gameOver');
        socket.off('startCountdown');
      };
    }
  }, [socket, toast]);

  const joinGame = () => {
    if (!gameId || !username) {
      toast({
        title: 'Error',
        description: 'Please enter both game ID and username',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.emit('joinGame', { gameId, username });
    newSocket.on('error', (error: string) => {
      toast({
        title: 'Error',
        description: error,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    });
  };

  const submitAnswer = (answerIndex: number) => {
    if (hasAnswered) return;
    if (socket && gameId) {
      socket.emit('submitAnswer', { gameId, answerIndex });
      setHasAnswered(true);
    }
  };

  const startGame = () => {
    if (socket && gameId) {
      socket.emit('startCountdown', gameId);
    }
  };

  function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(value);
    useEffect(() => {
      let start = display;
      let end = value;
      if (start === end) return;
      let step = (end - start) / 20;
      let current = start;
      let frame = 0;
      const interval = setInterval(() => {
        frame++;
        current += step;
        if ((step > 0 && current >= end) || (step < 0 && current <= end) || frame >= 20) {
          setDisplay(end);
          clearInterval(interval);
        } else {
          setDisplay(Math.round(current));
        }
      }, 30);
      return () => clearInterval(interval);
    }, [value]);
    return <span>{display}</span>;
  }

  useEffect(() => {
    if (!gameStarted || !currentQuestion) return;
    setTimeLeft(currentQuestion.timeLimit);
    if (showAnswer) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion, gameStarted, showAnswer]);

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="container.xl">
        <VStack gap={8}>
          <Heading size="2xl" color="purple.600">Kahoot Clone</Heading>

          {!socket ? (
            <Box w="100%" maxW="600px" p={6} borderRadius="lg" boxShadow="lg" bg="white">
              <VStack gap={4}>
                <Input
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  size="lg"
                />
                <Input
                  placeholder="Enter game ID (if joining)"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  size="lg"
                />
                <Button colorScheme="blue" onClick={joinGame} w="100%" size="lg">
                  Join Game
                </Button>
              </VStack>
            </Box>
          ) : (
            <Grid templateColumns="repeat(2, 1fr)" gap={8} w="100%">
              <GridItem>
                {isHost && !gameStarted && !currentQuestion && (
                  <Button colorScheme="green" size="lg" onClick={startGame}>
                    Start Game
                  </Button>
                )}
                {showCountdown && (
                  <Box position="fixed" top={0} left={0} w="100vw" h="100vh" bg="blackAlpha.700" zIndex={1000} display="flex" alignItems="center" justifyContent="center">
                    <Box bg="white" p={12} borderRadius="xl" boxShadow="2xl">
                      <Heading size="4xl" color="purple.600">{countdown}</Heading>
                      <Text fontSize="2xl" mt={4}>Get Ready!</Text>
                    </Box>
                  </Box>
                )}
                {currentQuestion && (
                  <Box p={6} borderRadius="lg" boxShadow="lg" bg="white">
                    <Box mb={4} textAlign="center">
                      <Text fontSize="lg" fontWeight="bold" color={timeLeft <= 5 ? 'red.500' : 'purple.600'}>
                        Time Left: {timeLeft}s
                      </Text>
                    </Box>
                    <Text fontSize="2xl" mb={6} fontWeight="bold">
                      {currentQuestion.text}
                    </Text>
                    <VStack gap={4}>
                      {currentQuestion.options.map((option, index) => (
                        <Button
                          key={index}
                          w="100%"
                          size="lg"
                          colorScheme={showAnswer && correctAnswerIndex === index ? 'green' : 'blue'}
                          variant="outline"
                          onClick={() => submitAnswer(index)}
                          _hover={{ bg: 'blue.50' }}
                          isDisabled={hasAnswered || showAnswer || timeLeft === 0}
                        >
                          {option}
                          {showAnswer && correctAnswerIndex === index && (
                            <span style={{ marginLeft: 8, color: 'green' }}>✔</span>
                          )}
                        </Button>
                      ))}
                    </VStack>
                    {showAnswer && (
                      <Box mt={4}>
                        <Text fontWeight="bold" color="green.600">Correct Answer: {currentQuestion.options[correctAnswerIndex ?? 0]}</Text>
                        <Text mt={2} fontWeight="bold">Correct Players:</Text>
                        <VStack>
                          {players.filter(p => correctPlayers.includes(p.id)).map(p => (
                            <Text key={p.id} color="green.700">{p.username} ✔</Text>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                )}
              </GridItem>

              <GridItem>
                {isHost && gameId && (
                  <Box mb={4} p={2} borderRadius="md" borderWidth={1} borderColor="purple.200" bg="purple.50">
                    <Text fontWeight="bold" color="purple.700">Game ID: {gameId}</Text>
                  </Box>
                )}
                <Box p={6} borderRadius="lg" boxShadow="lg" bg="white">
                  <Heading size="md" mb={4}>Players</Heading>
                  <VStack align="stretch" gap={3}>
                    {players.sort((a, b) => b.score - a.score).map((player) => (
                      <Box
                        key={player.id}
                        p={3}
                        borderRadius="md"
                        borderWidth={1}
                        bg={player.score > 0 ? 'green.50' : 'white'}
                      >
                        <Text fontWeight="bold">
                          {player.username}: {player.score}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </GridItem>
            </Grid>
          )}
          {showAnswer && leaderboard.length > 0 && (
            <Box p={6} borderRadius="lg" boxShadow="lg" bg="yellow.50" w="100%">
              <Heading size="md" mb={4}>Leaderboard</Heading>
              <VStack gap={2} align="stretch">
                {leaderboard.map((player, idx) => (
                  <HStack key={player.id} justify="space-between" p={2} borderRadius="md" bg={idx === 0 ? 'yellow.200' : 'white'}>
                    <Text fontWeight={idx === 0 ? 'bold' : 'normal'}>{idx + 1}. {player.username}</Text>
                    <Text fontWeight={idx === 0 ? 'bold' : 'normal'} color={idx === 0 ? 'orange.600' : 'gray.800'}>
                      <AnimatedNumber value={player.score} />
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  const handleGameCreated = (newSocket: Socket, id: string) => {
    setSocket(newSocket);
    setGameId(id);
    setIsHost(true);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp socket={socket} gameId={gameId} isHost={isHost} setSocket={setSocket} setGameId={setGameId} />} />
        <Route path="/create" element={<CreateGame onGameCreated={handleGameCreated} />} />
      </Routes>
    </Router>
  );
}
