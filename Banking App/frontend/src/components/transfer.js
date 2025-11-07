import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";

const API = "http://localhost:4000";

export default function Transfer() {
  const [accounts, setAccounts] = useState({ other: { name: "other", balance: 0 } });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    fromAccount: "checking",
    toType: "self",           // self | user
    toAccount: "savings",     // self
    toUserName: "",           // user
    toAccountIndex: 1,        // user (1=checking, 2=savings, 3=other)
    amount: "",
    category: "",
  });
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

  const otherLabel = accounts?.other?.name || "other";

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

      const payload = form.toType === "self"
        ? {
            fromAccount: form.fromAccount,
            toAccount: form.toAccount,
            amount: Number(form.amount),
            category: form.category,
          }
        : {
            fromAccount: form.fromAccount,
            toUserName: form.toUserName,
            toAccountIndex: Number(form.toAccountIndex),
            amount: Number(form.amount),
            category: form.category,
          };

      const r = await fetch(`${API}/bank/money/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Transfer failed");
      setForm({ ...form, amount: "", category: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="accounts-container">
      <div className="accounts-card">
        <h2 className="accounts-title">Transfer</h2>
        <p className="accounts-subtitle">Move money within your accounts or to another user</p>

        <div className="accounts-actions">
          <button className="btn secondary" onClick={() => navigate("/accounts")}>Back to Accounts</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">From</label>
              <select className="select" value={form.fromAccount}
                onChange={(e) => setForm({ ...form, fromAccount: e.target.value })}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">{otherLabel}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Transfer To</label>
              <select className="select" value={form.toType}
                onChange={(e) => setForm({ ...form, toType: e.target.value })}>
                <option value="self">My account</option>
                <option value="user">Another user</option>
              </select>
            </div>
          </div>

          {form.toType === "self" ? (
            <div className="form-group">
              <label className="label">Destination Account</label>
              <select className="select" value={form.toAccount}
                onChange={(e) => setForm({ ...form, toAccount: e.target.value })}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">{otherLabel}</option>
              </select>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="label">Recipient Username</label>
                <input className="input" value={form.toUserName}
                  onChange={(e) => setForm({ ...form, toUserName: e.target.value })}
                  placeholder="exact username" required />
              </div>
              <div className="form-group">
                <label className="label">Recipient Account</label>
                <select className="select" value={form.toAccountIndex}
                  onChange={(e) => setForm({ ...form, toAccountIndex: e.target.value })}>
                  <option value={1}>Checking</option>
                  <option value={2}>Savings</option>
                  <option value={3}>Other</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="label">Amount</label>
              <input className="input" type="number" step="0.01"
                     value={form.amount}
                     onChange={(e) => setForm({ ...form, amount: e.target.value })}
                     required />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input className="input" list="catlist"
                     value={form.category}
                     onChange={(e) => setForm({ ...form, category: e.target.value })}
                     placeholder="e.g., transfer" required />
            </div>
          </div>

          <button className="btn" type="submit">Click to Transfer</button>
        </form>

        <datalist id="catlist">
          {categories.map((c) => (<option key={c} value={c} />))}
        </datalist>
      </div>
    </div>
  );
}
