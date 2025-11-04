import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css"; // reuse the same design system
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = "http://localhost:4000";

export default function History() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // simple local filter for account view
  const [accountFilter, setAccountFilter] = useState("all"); // all|checking|savings|other

  const navigate = useNavigate();

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
        setUserName(match[1]);

        // full history
        const h = await fetch(`${API}/bank/history/all?limit=500`, { credentials: "include" });
        const hjson = await h.json();
        if (!h.ok) throw new Error(hjson.message || "Failed to load history");
        setItems(hjson.items || []);

        // category summary
        const sum = await fetch(`${API}/bank/history/summary/categories`, { credentials: "include" });
        const sjson2 = await sum.json();
        if (!sum.ok) throw new Error(sjson2.message || "Failed to load summary");
        const chartData = (sjson2.summary || []).map((row) => ({
          name: row.category || "(uncategorized)",
          value: Math.max(0.01, Number(row.totalDeposits) + Number(row.totalWithdrawals)),
        }));
        setSummary(chartData);
      } catch (e) {
        console.error(e);
        setError("Error retrieving history.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  function toMoney(n) {
    return Number(n || 0).toFixed(2);
  }

  const filteredItems =
    accountFilter === "all"
      ? items
      : items.filter(
          (t) => t.fromAccount === accountFilter || t.toAccount === accountFilter
        );

  if (loading) {
    return (
      <div className="accounts-container">
        <div className="accounts-card"><p>Loading…</p></div>
      </div>
    );
  }

  return (
    <div className="accounts-container">
      <div className="accounts-card">
        <h2 className="accounts-title">Bugslayers Banking</h2>
        <p className="accounts-subtitle">Transaction History — {userName}</p>

        <div className="accounts-actions">
          <button className="btn secondary" onClick={() => navigate("/accounts")}>
            Back to Accounts
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Controls */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Filter by Account</label>
              <select
                className="select"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="all">All accounts</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div
          className="forms-grid"
          style={{ gridTemplateColumns: "1.1fr .9fr", marginTop: 0 }}
        >
          {/* Table */}
          <div className="form-card" style={{ maxHeight: 520, overflow: "auto" }}>
            <h4 className="form-title">Transactions</h4>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                    {filteredItems.map((t) => {
                        const isTransfer = t.type === "transfer";
                        const isOut = t.direction === "out";
                        const isIn = t.direction === "in";
                        const fromText = isIn && t.fromUserName
                        ? `${t.fromAccount || "-"} ← ${t.fromUserName}`
                        : t.fromAccount || "-";
                        const toText = isOut && t.toUserName
                        ? `${t.toAccount || "-"} → ${t.toUserName}`
                        : t.toAccount || "-";

                        return (
                        <tr key={t._id}>
                            <td>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}</td>
                            <td>
                            {isTransfer ? (isOut ? "transfer out" : isIn ? "transfer in" : "transfer") : t.type}
                            </td>
                            <td>{fromText}</td>
                            <td>{toText}</td>
                            <td style={{ textAlign: "right" }}>${Number(t.amount || 0).toFixed(2)}</td>
                            <td>{t.category}</td>
                        </tr>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: 12 }}>
                            No transactions match the filter.
                        </td>
                        </tr>
                    )}
                    </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          <div className="form-card">
            <h4 className="form-title">Breakdown by Category</h4>
            {summary.length === 0 ? (
              <p>No data.</p>
            ) : (
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={summary} dataKey="value" nameKey="name" label />
                    <Tooltip />
                    {summary.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn secondary" onClick={() => navigate("/accounts")}>
            Return to Accounts
          </button>
        </div>
      </div>
    </div>
  );
}
