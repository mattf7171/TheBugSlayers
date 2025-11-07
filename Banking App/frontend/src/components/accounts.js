import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";
import Toast from "./Toast";

const API = "http://localhost:4001";

export default function Accounts() {
  const [userName, setUserName] = useState("");
  const [balances, setBalances] = useState(null);
  const [otherLabel, setOtherLabel] = useState("other");
  const [editingOther, setEditingOther] = useState(false);
  const [otherInput, setOtherInput] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function boot() {
      try {
        const s = await fetch(`${API}/session_get`, { credentials: "include" });
        const sjson = await s.json();
        const match = sjson.status.match(/Session username is: (\w+)/);
        if (!match) throw new Error("No active session.");
        setUserName(match[1]);

        const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
        const bjson = await b.json();
        if (!b.ok) throw new Error(bjson.message || "Failed to get balances");
        setBalances(bjson.accounts);
        setOtherLabel(bjson.accounts.other?.name || "other");
      } catch (e) {
        setError(e.message || "Error loading accounts.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  function toMoney(v) {
    return Number(v || 0).toFixed(2);
  }

  async function handleLogout() {
    await fetch(`${API}/session_delete`, { method: "GET", credentials: "include" });
    navigate("/");
  }

  function startEditOther() {
    setOtherInput(otherLabel);
    setEditingOther(true);
  }

  function cancelEditOther() {
    setEditingOther(false);
    setOtherInput("");
  }

  async function saveOther() {
    const name = (otherInput || "").trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    try {
      setError("");
      const r = await fetch(`${API}/bank/account/other-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to rename.");

      setOtherLabel(j.name);
      setEditingOther(false);
      setToast(`Renamed "${otherLabel}" to "${j.name}".`);

      // optionally refresh balances to reflect new label
      try {
        const b = await fetch(`${API}/bank/account/balances`, { credentials: "include" });
        const bjson = await b.json();
        if (b.ok) setBalances(bjson.accounts);
      } catch (_) {}
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="accounts-container">
        <div className="accounts-card"><p>Loading…</p></div>
      </div>
    );
  }

  return (
    <>
      <div className="accounts-container">
        <div className="accounts-card">
          <h2 className="accounts-title">Accounts</h2>
          <p className="accounts-subtitle">Welcome {userName}</p>

          {error && <div className="error-banner">{error}</div>}

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
                        {!editingOther ? (
                          <>
                            <span>{otherLabel}</span>
                            <button className="btn secondary" onClick={startEditOther} style={{ padding: "6px 10px" }}>
                              Rename
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              className="input"
                              value={otherInput}
                              onChange={(e) => setOtherInput(e.target.value)}
                              placeholder="New label"
                              style={{ maxWidth: 240 }}
                            />
                            <button className="btn" onClick={saveOther} type="button" style={{ padding: "8px 12px" }}>
                              Save
                            </button>
                            <button className="btn secondary" onClick={cancelEditOther} type="button" style={{ padding: "8px 12px" }}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>${toMoney(balances.other?.balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="accounts-actions" style={{ justifyContent: "center" }}>
            <button className="btn" onClick={() => navigate("/deposit-withdraw")}>Deposit / Withdraw</button>
            <button className="btn" onClick={() => navigate("/transfer")}>Transfer</button>
            <button className="btn secondary" onClick={() => navigate("/history")}>View History</button>
            <button className="btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>

      {/* floating toast */}
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  );
}
