import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSpeedSocket(playerName) {
  const socketRef = useRef(null); // holds socket instance across renders

  const [lobbyPlayers, setLobbyPlayers] = useState([]); // lobby state
  const [gamePlayers, setGamePlayers] = useState({}); // game players object keyed by socketId
  const [gameState, setGameState] = useState(null); // full game state
  const [countdown, setCountdown] = useState(null); // countdown
  const [connected, setConnected] = useState(false);  // connection
  const [socketId, setSocketId] = useState(null); // connection identity

  // Create socket connection once
  useEffect(() => {
    const socket = io("http://localhost:4000", {
      withCredentials: true,
    });

    socketRef.current = socket;

    // fired when socket.io successfully connects
    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id);
    });

    // backend confirms playerId after registration
    socket.on("player:registered", ({ name, playerId }) => {
      setSocketId(playerId);
    });

    // lobby updates
    socket.on("players:update", (players) => {
      setLobbyPlayers(players);
    });

    // countdown
    socket.on("game:countdown", ({ seconds }) => {
      setCountdown(seconds);
    });

    // initial game state when match begins
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

    // ongoing game updates
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

    // game finished event
    socket.on("game:finished", ({ winner, winnerId, opponentCardsLeft }) => {
      setGameState((prev) => ({
        ...prev,
        winner,
        winnerId,
        opponentCardsLeft,
        phase: "finished",
      }));
    });

    // Flip votes updates
    socket.on("pile:flipStatus", (votes) => {
      setGameState((prev) => ({
        ...prev,
        flipVotes: votes,
      }));
    });

    // lobby full
    socket.on("lobby:full", ({ message }) => {
      alert(message);
    });

    // cleanup
    return () => socket.disconnect();
  }, []);

  // Register player name after socket connects
  useEffect(() => {
    if (connected && playerName) {
      socketRef.current.emit("player:register", { name: playerName });
    }
  }, [connected, playerName]);

  // Outgoing actions //
  // mark player as ready
  const sendReady = () => {
    socketRef.current.emit("player:ready");
  };

  // attempt to play a card
  const playCard = (cardId, pile) => {
    socketRef.current.emit("card:play", { cardId, pile });
  };

  // draw a card
  const drawCard = () => {
    socketRef.current.emit("card:draw");
  };

  // request to flip side piles
  const requestFlip = () => {
    socketRef.current.emit("pile:flipRequest");
  };

  // request to play again
  const sendPlayAgain = () => {
    socketRef.current.emit("game:playAgain");
  };

  // expose all state + actions to the component 
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