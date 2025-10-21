// src/components/Game.js
import React, { useState } from "react";
import BuySellScreen from "./buySellScreen";
import axios from "axios";
import './game.css';

// Function to control game (shows screen with options to buy, sell, hold, or quit)
export default function Game({ gameState, onExit }) {
    const [state, setState] = useState(gameState);
    const [mode, setMode] = useState(""); // "buy", "sell", or ""
    const MAX_DAYS = 7;

    // ran when user selects 'Hold'
    const handleHold = async () => {
        if (state.day >= MAX_DAYS) {
            handleQuit(); // end the game
            return;
        };

        try {
            console.log("Current date before hold: ", state.currentDate);
            const res = await axios.get("/api/stock-price", {
                params: {
                    symbol: state.ticker,
                    date: state.currentDate,
                    direction: "next"
                }
            });
            console.log("Next date from API:", res.data.date);

            const nextPrice = res.data.price;
            const nextDate = res.data.date;

            setState((prev) => ({
                ...prev,
                day: prev.day + 1,
                price: nextPrice,
                currentDate: nextDate
            }));
            setTimeout(() => {
                console.log("Updated currentDate:", state.currentDate);
            }, 100);

        } catch (err) {
            alert("Failed to fetch next day price.");
        }
        };

        // Ran when user selects 'Quit'
        const handleQuit = () => {
        const finalCash = state.shares * state.price;
        const totalBank = state.bank + finalCash;
        const gain = totalBank - 10000;

        alert(`Game Over!\nTotal Gain/Loss: $${gain.toFixed(2)}\nDays Played: ${state.day}`);
        onExit();
        };

        // Ran when user selects 'Buy' or 'Sell'
        const handleTransaction = (type, amount) => {
        try {
            let newBank = state.bank;
            let newShares = state.shares;
            let newInvestment = state.investment;

            const amt = parseFloat(amount);

            if (type === "buy" && amt > 0 && amt <= newBank) {
                const sharesToBuy = amt / state.price;
                newBank -= amt;
                newShares += sharesToBuy;
                newInvestment += amt;
            };

            if (type === "sell" && amt > 0 && amt <= newShares) {
                const cashOut = amt * state.price;
                newBank += cashOut;
                newShares -= amt;
                newInvestment -= cashOut;
            };

            setState((prev) => ({
                ...prev,
                bank: newBank,
                shares: newShares,
                investment: newInvestment
            }));

            setMode(""); // return to game view
            handleHold(); // progress to next day
        } catch (err) {
            if (err.response?.status === 429) {
                alert("You're making requests too quickly. Please wait and try again.");
            } else {
                alert("Transaction failed. Please try again.");
            };
        };
        };

        if (mode) {
        return (
            <BuySellScreen
            mode={mode}
            max={mode === "buy" ? state.bank : state.shares}
            price={state.price}
            onSubmit={(amt) => handleTransaction(mode, amt)}
            onCancel={() => setMode("")}
            />
        );
    }

    return (
    <div className="game-page">
        <div className="game-card">
        
            {/* Header */}
            <div className="header-section">
                <h1 className="game-title">Day {state.day}</h1>
                <p className="game-description">
                Ticker: <span className="ticker-symbol">{state.ticker}</span>
                </p>
            </div>

            {/* Stats Section */}
            <div className="stats-section">
                <div className="stat-row">
                    <span className="stat-label">Price:</span>
                    <span className="stat-value">${state.price.toFixed(2)}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Bank:</span>
                    <span className="stat-value">${state.bank.toFixed(2)}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Shares:</span>
                    <span className="stat-value">{state.shares.toFixed(4)}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-section">
                <button className="action-button" onClick={() => setMode("buy")}>Buy</button>
                <button className="action-button" onClick={() => setMode("sell")}>Sell</button>
                <button className="action-button" onClick={handleHold}>Hold</button>
                <button className="quit-button" onClick={handleQuit}>Quit</button>
            </div>

        </div>
    </div>
    );

}
