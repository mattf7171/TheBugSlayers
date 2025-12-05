import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSpeedSocket(playerName) {
  const socketRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  // ✅ 1. Create socket ONCE
  useEffect(() => {
    const socket = io("http://localhost:4000", {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id);
    });

    socket.on("players:update", (players) => {
      setPlayers(players);
    });

    socket.on("game:countdown", ({ seconds }) => {
      setCountdown(seconds);
    });

    socket.on("game:start", (data) => {
      setGameState({
        players: data.players,
        centerPiles: data.centerPiles,
        phase: data.phase,
      });
    });

    socket.on("game:update", (data) => {
      setGameState((prev) => ({
        ...prev,
        players: data.players,
        centerPiles: data.centerPiles,
        sidePiles: data.sidePiles,
      }));
    });

    socket.on("game:finished", ({ winner }) => {
      setGameState((prev) => ({
        ...prev,
        winner,
        phase: "finished",
      }));
    });

    socket.on("pile:flipStatus", (votes) => {
      setGameState((prev) => ({
        ...prev,
        flipVotes: votes,
      }));
    });

    return () => socket.disconnect();
  }, []); // ✅ empty array → runs once only

  // ✅ 2. Register player name AFTER socket connects
  useEffect(() => {
    if (connected && playerName) {
      socketRef.current.emit("player:register", { name: playerName });
    }
  }, [connected, playerName]);

  // --- Outgoing actions ---
  const sendReady = () => {
    socketRef.current.emit("player:ready");
  };

  const playCard = (card, pile) => {
    socketRef.current.emit("card:play", { card, pile });
  };

  const drawCard = () => {
    socketRef.current.emit("card:draw");
  };

  const requestFlip = () => {
    socketRef.current.emit("pile:flipRequest");
  };

  return {
    connected,
    players,
    gameState,
    countdown,
    sendReady,
    playCard,
    drawCard,
    requestFlip,
    socketId,
  };
}
