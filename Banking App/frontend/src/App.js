import React from "react";
import { Route, Routes } from "react-router-dom";
import Register from  "./components/register.js";
import Login from "./components/login.js";
import SessionGet from "./components/session_get.js";
import Accounts from "./components/accounts.js";
import History from "./components/history.js";
import Deposit from "./components/deposit.js";
import Withdraw from "./components/withdraw.js";
import Transfer from "./components/transfer.js";


const App = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/history" element={<History />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/session_get" element={<SessionGet/>} />
      </Routes>
    </div>
  );
}
export default App;
