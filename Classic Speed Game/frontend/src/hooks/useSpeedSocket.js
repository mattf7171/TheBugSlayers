import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSpeedSocket(playerName) {
  const socketRef = useRef(null);

  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [gamePlayers, setGamePlayers] = useState({});
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  // Create socket connection once
  useEffect(() => {
    const socket = io("http://localhost:4000", {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id);
    });

    socket.on("player:registered", ({ name, playerId }) => {
      setSocketId(playerId);
    });

    socket.on("players:update", (players) => {
      setLobbyPlayers(players);
    });

    socket.on("game:countdown", ({ seconds }) => {
      setCountdown(seconds);
    });

    socket.on("game:start", (data) => {
      setGamePlayers(data.players);
      setGameState({
        players: data.players,
        centerPiles: data.centerPiles,
        sidePiles: data.sidePiles,
        phase: data.phase,
        flipVotes: {},
      });
      setCountdown(null);
    });

    socket.on("game:update", (data) => {
      setGamePlayers(data.players);
      setGameState((prev) => ({
        ...prev,
        players: data.players,
        centerPiles: data.centerPiles,
        sidePiles: data.sidePiles,
        flipVotes: data.flipVotes ?? prev.flipVotes,
      }));
    });

    socket.on("game:finished", ({ winner, winnerId, opponentCardsLeft }) => {
      setGameState((prev) => ({
        ...prev,
        winner,
        winnerId,
        opponentCardsLeft,
        phase: "finished",
      }));
    });

    socket.on("pile:flipStatus", (votes) => {
      setGameState((prev) => ({
        ...prev,
        flipVotes: votes,
      }));
    });

    socket.on("lobby:full", ({ message }) => {
      alert(message);
    });

    return () => socket.disconnect();
  }, []);

  // Register player name after socket connects
  useEffect(() => {
    if (connected && playerName) {
      socketRef.current.emit("player:register", { name: playerName });
    }
  }, [connected, playerName]);

  // Outgoing actions
  const sendReady = () => {
    socketRef.current.emit("player:ready");
  };

  const playCard = (cardId, pile) => {
    socketRef.current.emit("card:play", { cardId, pile });
  };

  const drawCard = () => {
    socketRef.current.emit("card:draw");
  };

  const requestFlip = () => {
    socketRef.current.emit("pile:flipRequest");
  };

  const sendPlayAgain = () => {
    socketRef.current.emit("game:playAgain");
  };

  return {
    connected,
    lobbyPlayers,
    gamePlayers,
    gameState,
    countdown,
    sendReady,
    playCard,
    drawCard,
    requestFlip,
    socketId,
    sendPlayAgain,
  };
}