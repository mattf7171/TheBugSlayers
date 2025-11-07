import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";

const API = "http://localhost:4000";

export default function DepositWithdraw() {
  const [mode, setMode] = useState("deposit"); // deposit | withdraw
  const [accounts, setAccounts] = useState({ checking: 0, savings: 0, other: { name: "other", balance: 0 } });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ account: "checking", amount: "", category: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function boot() {
      try {
        const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
        const bjson = await b.json();
        if (b.ok) setAccounts(bjson.accounts);

        const c = await fetch(`${API}/bank/categories`, { credentials: "include" });
        const cjson = await c.json();
        setCategories(cjson.categories || []);
      } catch (e) {
        setError("Failed to load data.");
      }
    }
    boot();
  }, []);

  function toMoney(n) {
    return Number(n || 0).toFixed(2);
  }

  async function apiEnsureCategory(name) {
    const clean = String(name || "").trim();
    if (!clean) return;
    await fetch(`${API}/bank/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: clean }),
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await apiEnsureCategory(form.category);
      const endpoint = mode === "deposit" ? "deposit" : "withdraw";
      const r = await fetch(`${API}/bank/money/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          account: form.account,
          amount: Number(form.amount),
          category: form.category,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Action failed");
      const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
      setAccounts((await b.json()).accounts);
      setForm({ ...form, amount: "", category: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  const otherLabel = accounts?.other?.name || "other";

  return (
    <div className="accounts-container">
      <div className="accounts-card">
        <h2 className="accounts-title">Deposit/Withdraw</h2>
        <p className="accounts-subtitle">Choose an action and submit a transaction</p>

        <div className="accounts-actions" style={{ gap: 8 }}>
          <button className={`btn ${mode === "deposit" ? "" : "secondary"}`} onClick={() => setMode("deposit")}>Deposit</button>
          <button className={`btn ${mode === "withdraw" ? "" : "secondary"}`} onClick={() => setMode("withdraw")}>Withdraw</button>
          <button className="btn secondary" onClick={() => navigate("/accounts")}>Back to Accounts</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* balances snapshot */}
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr><th>Account</th><th style={{ textAlign: "right" }}>Balance</th></tr>
            </thead>
            <tbody>
              <tr><td>Checking</td><td style={{ textAlign: "right" }}>${toMoney(accounts.checking)}</td></tr>
              <tr><td>Savings</td><td style={{ textAlign: "right" }}>${toMoney(accounts.savings)}</td></tr>
              <tr><td>{otherLabel}</td><td style={{ textAlign: "right" }}>${toMoney(accounts.other?.balance)}</td></tr>
            </tbody>
          </table>
        </div>

        <form className="form-card" style={{ marginTop: 16 }} onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Amount</label>
              <input className="input" type="number" step="0.01"
                     value={form.amount}
                     onChange={(e) => setForm({ ...form, amount: e.target.value })}
                     required />
            </div>
            <div className="form-group">
              <label className="label">Account</label>
              <select className="select"
                      value={form.account}
                      onChange={(e) => setForm({ ...form, account: e.target.value })}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">{otherLabel}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <input className="input" list="catlist"
                   value={form.category}
                   onChange={(e) => setForm({ ...form, category: e.target.value })}
                   placeholder="e.g., cash, paycheck, bills" required/>
          </div>
          <button className="btn" type="submit">
            {mode === "deposit" ? "Make Deposit" : "Make Withdrawal"}
          </button>
        </form>

        <datalist id="catlist">
          {categories.map((c) => (<option key={c} value={c} />))}
        </datalist>
      </div>
    </div>
  );
}
