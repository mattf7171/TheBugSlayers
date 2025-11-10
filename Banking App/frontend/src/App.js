import React from "react";
import { Route, Routes } from "react-router-dom";
import Register from "./components/register.js";
import Login from "./components/login.js";
import Accounts from "./components/accounts.js";
import History from "./components/history.js";
import DepositWithdraw from "./components/deposit_withdraw.js";
import Transfer from "./components/transfer.js";
import Layout from "./components/Layout.js";

const App = () => {
  return (
    <Routes>
      {/* auth pages (no navbar) */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* app pages with navbar */}
      <Route element={<Layout />}>
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/deposit-withdraw" element={<DepositWithdraw />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/history" element={<History />} />
      </Route>
    </Routes>
  );
};
export default App;
