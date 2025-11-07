import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

const API = "http://localhost:4001";

// Accessible, high-contrast palette
const PALETTE = [
  "#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0",
  "#00BCD4", "#8BC34A", "#FFC107", "#FF5722", "#3F51B5",
  "#795548", "#607D8B", "#009688", "#673AB7", "#CDDC39"
];

// Simple string hash to assign stable colors by category
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}
function colorForCategory(name) {
  const key = (name || "(uncategorized)").toLowerCase().trim();
  return PALETTE[hashStr(key) % PALETTE.length];
}

export default function History() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    async function boot() {
      try {
        const s = await fetch(`${API}/session_get`, { credentials: "include" });
        const sjson = await s.json();
        const match = sjson.status.match(/Session username is: (\w+)/);
        if (!match) throw new Error("No active session.");
        setUserName(match[1]);

        // Full history (table)
        const h = await fetch(`${API}/bank/history/all?limit=500`, { credentials: "include" });
        const hjson = await h.json();
        if (!h.ok) throw new Error(hjson.message || "Failed to load history");
        setItems(hjson.items || []);

        // Summary for chart
        const sum = await fetch(`${API}/bank/history/summary/categories`, { credentials: "include" });
        const sjson2 = await sum.json();
        if (!sum.ok) throw new Error(sjson2.message || "Failed to load summary");

        // Build chart data WITHOUT a minimum clamp and drop zero-value categories
        const chartData = (sjson2.summary || [])
          .map((row) => {
            const name = row.category || "(uncategorized)";
            // Use absolute totals so categories are positive; adjust if your API already returns absolutes.
            const total = Number(row.totalDeposits || 0) + Number(row.totalWithdrawals || 0);
            const value = Math.round(total * 100) / 100; // round to cents
            return { name, value, fill: colorForCategory(name) };
          })
          .filter((d) => d.value > 0); // drop zeros so there are no phantom slivers

        setSummary(chartData);
      } catch (e) {
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
      : items.filter((t) => t.fromAccount === accountFilter || t.toAccount === accountFilter);

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
        <h2 className="accounts-title">Transaction History</h2>
        <p className="accounts-subtitle">Overview for {userName}</p>

        <div className="accounts-actions">
          <button className="btn secondary" onClick={() => navigate("/accounts")}>
            Back to Accounts
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Filter by Account</label>
              <select className="select" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="all">All accounts</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="forms-grid" style={{ gridTemplateColumns: "1.1fr .9fr", marginTop: 0 }}>
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
                    const fromText =
                      isIn && t.fromUserName
                        ? `${t.fromAccount || "-"} ← ${t.fromUserName}`
                        : t.fromAccount || "-";
                    const toText =
                      isOut && t.toUserName
                        ? `${t.toAccount || "-"} → ${t.toUserName}`
                        : t.toAccount || "-";

                    return (
                      <tr key={t._id}>
                        <td>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}</td>
                        <td>{isTransfer ? (isOut ? "transfer out" : isIn ? "transfer in" : "transfer") : t.type}</td>
                        <td>{fromText}</td>
                        <td>{toText}</td>
                        <td style={{ textAlign: "right" }}>${toMoney(t.amount)}</td>
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

          {/* Colorful Pie with currency formatting */}
          <div className="form-card">
            <h4 className="form-title">Breakdown by Category</h4>
            {summary.length === 0 ? (
              <p>No data.</p>
            ) : (
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={summary}
                      dataKey="value"
                      nameKey="name"
                      // Label shows name + money with $ sign
                      label={({ name, value }) => `${name} ($${Number(value).toFixed(2)})`}
                      labelLine
                    >
                      {summary.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    {/* Tooltip with currency */}
                    <Tooltip
                      formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
