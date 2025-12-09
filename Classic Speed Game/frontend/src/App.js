import React from "react";
import Lobby from "./components/Lobby";
import "./App.css";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="App">
        <Lobby />
      </div>
    </DndProvider>
  );
}

export default App;
