import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";

const API = "http://localhost:4000";

export default function Accounts() {
  const [userName, setUserName] = useState("");
  const [balances, setBalances] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Forms
  const [depositForm, setDepositForm] = useState({ account: "checking", amount: "", category: "" });
  const [withdrawForm, setWithdrawForm] = useState({ account: "checking", amount: "", category: "" });
  const [transferForm, setTransferForm] = useState({
    fromAccount: "checking",
    toType: "self",           // "self" | "user"
    toAccount: "savings",     // intra-user
    toUserName: "",           // inter-user
    toAccountIndex: 1,        // 1=checking,2=savings,3=other
    amount: "",
    category: "",
  });
  const [otherLabel, setOtherLabel] = useState("");

  const navigate = useNavigate();

  // Session -> user -> balances + categories
  useEffect(() => {
    async function boot() {
      try {
        const s = await fetch(`${API}/session_get`, { credentials: "include" });
        const sjson = await s.json();
        const match = sjson.status.match(/Session username is: (\w+)/);
        if (!match) {
          setError("No active session.");
          setLoading(false);
          return;
        }
        const u = match[1];
        setUserName(u);

        const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
        const bjson = await b.json();
        if (!b.ok) throw new Error(bjson.message || "Failed to get balances");
        setBalances(bjson.accounts);
        setOtherLabel(bjson.accounts.other?.name || "other");

        const c = await fetch(`${API}/bank/categories`, { credentials: "include" });
        const cjson = await c.json();
        setCategories(cjson.categories || []);
      } catch (e) {
        console.error(e);
        setError("Error retrieving account info.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  async function handleLogout() {
    await fetch(`${API}/session_delete`, { method: "GET", credentials: "include" });
    navigate("/");
  }

  function ensureCategoryInline(name) {
    const clean = String(name || "").trim();
    if (clean && !categories.includes(clean)) {
      setCategories((prev) => [...prev, clean]);
    }
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

  async function doDeposit(e) {
    e.preventDefault();
    const { account, amount, category } = depositForm;
    try {
      await apiEnsureCategory(category);
      const r = await fetch(`${API}/bank/money/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ account, amount: Number(amount), category }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Deposit failed");
      ensureCategoryInline(category);
      const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
      setBalances((await b.json()).accounts);
      setDepositForm({ account, amount: "", category: "" });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function doWithdraw(e) {
    e.preventDefault();
    const { account, amount, category } = withdrawForm;
    try {
      await apiEnsureCategory(category);
      const r = await fetch(`${API}/bank/money/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ account, amount: Number(amount), category }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Withdrawal failed");
      ensureCategoryInline(category);
      const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
      setBalances((await b.json()).accounts);
      setWithdrawForm({ account, amount: "", category: "" });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function doTransfer(e) {
    e.preventDefault();
    const f = transferForm;
    try {
      await apiEnsureCategory(f.category);
      const payload =
        f.toType === "self"
          ? {
              fromAccount: f.fromAccount,
              toAccount: f.toAccount,
              amount: Number(f.amount),
              category: f.category,
            }
          : {
              fromAccount: f.fromAccount,
              toUserName: f.toUserName,
              toAccountIndex: Number(f.toAccountIndex),
              amount: Number(f.amount),
              category: f.category,
            };

      const r = await fetch(`${API}/bank/money/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Transfer failed");
      ensureCategoryInline(f.category);
      const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
      setBalances((await b.json()).accounts);
      setTransferForm({ ...transferForm, amount: "", category: "" });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveOtherLabel() {
    try {
      const r = await fetch(`${API}/bank/account/other-label`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: otherLabel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to set label");
      const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
      setBalances((await b.json()).accounts);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function toMoney(v) {
    return Number(v || 0).toFixed(2);
  }

  if (loading) return <div className="accounts-container"><div className="accounts-card"><p>Loading user info...</p></div></div>;

  return (
    <div className="accounts-container">
      <div className="accounts-card">
        <h2 className="accounts-title">Bugslayers Banking</h2>
        <p className="accounts-subtitle">Welcome {userName}! Manage your accounts and transactions.</p>

        <div className="accounts-actions">
          <button className="btn secondary" onClick={() => navigate("/history")}>View History</button>
          <button className="btn" onClick={handleLogout}>Logout</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Balances */}
        {balances && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Checking</td>
                  <td style={{ textAlign: "right" }}>${toMoney(balances.checking)}</td>
                </tr>
                <tr>
                  <td>Savings</td>
                  <td style={{ textAlign: "right" }}>${toMoney(balances.savings)}</td>
                </tr>
                <tr>
                  <td>
                    <div className="other-label-row">
                      <input
                        className="input"
                        value={otherLabel}
                        onChange={(e) => setOtherLabel(e.target.value)}
                        placeholder="Other account name"
                      />
                      <button className="btn secondary" type="button" onClick={saveOtherLabel}>Save label</button>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>${toMoney(balances.other?.balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Forms */}
        <div className="forms-grid">
          {/* Deposit */}
          <form className="form-card" onSubmit={doDeposit}>
            <h4 className="form-title">Deposit</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Account</label>
                <select
                  className="select"
                  value={depositForm.account}
                  onChange={(e) => setDepositForm({ ...depositForm, account: e.target.value })}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="other">{otherLabel || "Other"}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input
                className="input"
                list="catlist"
                value={depositForm.category}
                onChange={(e) => setDepositForm({ ...depositForm, category: e.target.value })}
                placeholder="e.g., cash, paycheck"
                required
              />
            </div>
            <button className="btn" type="submit">Deposit</button>
          </form>

          {/* Withdraw */}
          <form className="form-card" onSubmit={doWithdraw}>
            <h4 className="form-title">Withdraw</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Account</label>
                <select
                  className="select"
                  value={withdrawForm.account}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, account: e.target.value })}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="other">{otherLabel || "Other"}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input
                className="input"
                list="catlist"
                value={withdrawForm.category}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, category: e.target.value })}
                placeholder="e.g., food, bills, cash"
                required
              />
            </div>
            <button className="btn" type="submit">Withdraw</button>
          </form>
        </div>

        {/* Transfer */}
        <form className="form-card" style={{ marginTop: 18 }} onSubmit={doTransfer}>
          <h4 className="form-title">Transfer</h4>
          <div className="form-row">
            <div className="form-group">
              <label className="label">From</label>
              <select
                className="select"
                value={transferForm.fromAccount}
                onChange={(e) => setTransferForm({ ...transferForm, fromAccount: e.target.value })}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">{otherLabel || "Other"}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Transfer To</label>
              <select
                className="select"
                value={transferForm.toType}
                onChange={(e) => setTransferForm({ ...transferForm, toType: e.target.value })}
              >
                <option value="self">My account</option>
                <option value="user">Another user</option>
              </select>
            </div>
          </div>

          {transferForm.toType === "self" ? (
            <div className="form-group">
              <label className="label">Destination Account</label>
              <select
                className="select"
                value={transferForm.toAccount}
                onChange={(e) => setTransferForm({ ...transferForm, toAccount: e.target.value })}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">{otherLabel || "Other"}</option>
              </select>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="label">Recipient Username</label>
                <input
                  className="input"
                  value={transferForm.toUserName}
                  onChange={(e) => setTransferForm({ ...transferForm, toUserName: e.target.value })}
                  placeholder="exact username"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Recipient Account</label>
                <select
                  className="select"
                  value={transferForm.toAccountIndex}
                  onChange={(e) => setTransferForm({ ...transferForm, toAccountIndex: e.target.value })}
                >
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
              <input
                className="input"
                type="number"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input
                className="input"
                list="catlist"
                value={transferForm.category}
                onChange={(e) => setTransferForm({ ...transferForm, category: e.target.value })}
                placeholder="e.g., transfer"
                required
              />
            </div>
          </div>

          <button className="btn" type="submit">Transfer</button>
        </form>

        {/* Datalist for categories (shared) */}
        <datalist id="catlist">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="footer-actions">
          <button className="btn secondary" onClick={() => navigate("/history")}>Account History</button>
          <button className="btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
