import React, { useState } from "react";
import Home from "./components/home";
import Game from "./components/game";
import "./styles.css";

export default function App() {
  const [gameState, setGameState] = useState(null);

  return (
    <>
      {!gameState ? (
        <Home onGameStarted={setGameState} />
      ) : (
        <Game gameState={gameState} onExit={() => setGameState(null)} />
      )}
    </>
  );
}
