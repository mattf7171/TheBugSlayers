import React, { useState } from "react";
import GameBoard from "./GameBoard";
import useSpeedSocket from "../hooks/useSpeedSocket";

export default function Lobby() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ✅ Always call the hook (React requirement)
  const {
    players,
    gameState,
    countdown,
    sendReady,
    playCard,
    drawCard,
    requestFlip,
    socketId,
  } = useSpeedSocket(submitted ? name : null); 
  // ✅ Pass null until submitted

  // ✅ Name entry screen
  if (!submitted) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Enter your name</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <br />
        <button
          onClick={() => {
            if (name.trim()) setSubmitted(true);
          }}
          style={{ marginTop: "10px" }}
        >
          Join
        </button>
      </div>
    );
  }

  // ✅ Countdown screen
  if (countdown !== null && countdown > 0) {
    return <h1>Game starting in {countdown}</h1>;
  }

  // ✅ Game board
  if (gameState?.phase === "playing") {
    return (
      <GameBoard
        gameState={gameState}
        playCard={playCard}
        drawCard={drawCard}
        requestFlip={requestFlip}
        playerId={socketId}
      />
    );
  }

  // ✅ Waiting room
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Waiting Room</h2>

    {players?.map((p) => (
        <div key={p.id}>
            {p.name} — {p.ready ? "✅ Ready" : "⏳ Waiting"}
        </div>
    ))}



      <button onClick={sendReady} style={{ marginTop: "10px" }}>
        Ready
      </button>
    </div>
  );
}
