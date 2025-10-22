import React, { useEffect, useMemo, useRef, useState } from "react";
import "./buySell.css";

export default function BuySellScreen({ mode = "buy", max = 0, price = 0, onSubmit, onCancel }) {
  const isBuy = mode === "buy";
  const unitLabel = isBuy ? "USD" : "shares";

  const [amount, setAmount] = useState(0);
  const [error, setError] = useState("");
  const prevPctRef = useRef(0);
  const EPS = isBuy ? 0.005 : 1e-6; // tolerance: 0.5¢ for USD, tiny for shares

  const pct = useMemo(() => (max > 0 ? clamp(amount / max, 0, 1) : 0), [amount, max]);
  const angle = useMemo(() => pct * 2 * Math.PI, [pct]);
  const isFull = pct >= 0.999;

  useEffect(() => {
    if (amount > max) setAmount(max);
  }, [max]); // keep clamped if max changes

  const handleInput = (e) => {
    const v = parseFloat(e.target.value);
    const nextAmount = Number.isNaN(v) ? 0 : clamp(v, 0, max);
    prevPctRef.current = max > 0 ? nextAmount / max : 0;
    setAmount(nextAmount);
  };

  const handleSlider = (e) => {
    const p = parseFloat(e.target.value);
    if (!Number.isNaN(p)) {
      const pc = clamp(p, 0, 1);
      prevPctRef.current = pc;
      const raw = max * pc;
      const rounded = roundTo(raw, isBuy ? 2 : 4);
      setAmount(Math.min(rounded, max)); // never exceed max
    }
  };

  // ---- Draggable Pie ----
  const size = 220;
  const r = 80;
  const cx = size / 2;
  const cy = size / 2;
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef(null);

  const handlePos = {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  };

  const onPointerDown = (e) => {
    setDragging(true);
    capturePointer(e);
    updateFromPointer(e);
  };
  const onPointerMove = (e) => dragging && updateFromPointer(e);
  const onPointerUp = () => setDragging(false);

  function capturePointer(e) {
    if (svgRef.current && e.pointerId != null) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
  }

  function updateFromPointer(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    let theta = Math.atan2(y, x) + Math.PI / 2;
    if (theta < 0) theta += 2 * Math.PI;
    if (theta > 2 * Math.PI) theta %= 2 * Math.PI;

    const rawPct = clamp(theta / (2 * Math.PI), 0, 1);
    const prev = prevPctRef.current;
    let snappedPct = rawPct;

    // prevent wrap-around
    if (prev > 0.98 && rawPct < 0.02) snappedPct = 1;
    else if (prev < 0.02 && rawPct > 0.98) snappedPct = 0;

    if (snappedPct > 0.997) snappedPct = 1;
    if (snappedPct < 0.003) snappedPct = 0;

    prevPctRef.current = snappedPct;
    const raw = max * snappedPct;
    const rounded = roundTo(raw, isBuy ? 2 : 4);
    setAmount(Math.min(rounded, max)); // never exceed max
  }

  const arcPath = useMemo(() => {
    if (isFull) return "";
    const a = angle;
    const start = polarToCartesian(cx, cy, r, -90);
    const end = polarToCartesian(cx, cy, r, radToDeg(a) - 90);
    const largeArcFlag = a > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  }, [angle, isFull]);

  const submit = () => {
    setError("");
    let safe = amount;
    if (safe <= EPS) return setError(`Enter a ${unitLabel} amount greater than 0.`);
    // tolerate tiny overages due to float math
    if (safe > max + EPS) return setError(`Amount exceeds available ${unitLabel}.`);
    // clamp and round to the right precision before sending
    safe = Math.min(safe, max);
    safe = roundTo(safe, isBuy ? 2 : 4);
    onSubmit?.(safe);
  };

  const helper = isBuy
    ? `Buying $${amount.toFixed(2)} ≈ ${(price > 0 ? amount / price : 0).toFixed(4)} shares`
    : `Selling ${amount.toFixed(4)} shares ≈ $${(amount * price).toFixed(2)}`;

  return (
    <div className="home-page">
      <div className="home-card buysell-card">
        <div className="header-section">
          <h1 className="game-title">{isBuy ? "Buy" : "Sell"} {isBuy ? "with Cash" : "Shares"}</h1>
          <p className="game-description">Make the right decision!</p>
        </div>

        <div className="buysell-grid">
          {/* Circular Pie */}
          <svg
            ref={svgRef}
            width={size}
            height={size}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onMouseDown={(e) => e.preventDefault()}
            style={{ touchAction: "none", cursor: "pointer", userSelect: "none" }}
          >
            {/* Background ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e0f0e0" strokeWidth="24" />
            {/* Filled arc or full circle */}
            {isFull ? (
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4caf50" strokeWidth="24" />
            ) : (
              arcPath && (
                <path
                  d={arcPath}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="24"
                  strokeLinecap="round"
                />
              )
            )}
            {/* Text */}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fill="#2d5a2d" fontWeight="700">
              {isBuy ? `$${amount.toFixed(2)}` : `${amount.toFixed(4)} sh`}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="12" fill="#5a7a5a">
              {Math.round(pct * 100)}% of {isBuy ? "bank" : "position"}
            </text>
            {/* Handle */}
            <circle cx={handlePos.x} cy={handlePos.y} r="10" fill="#45a049" stroke="white" strokeWidth="3" />
          </svg>

          {/* Controls */}
          <div>
            <h2 className="section-title" style={{ textAlign: "left" }}>
              {isBuy ? "Buy Amount (USD)" : "Sell Amount (shares)"}
            </h2>
            <input
              type="number"
              step={isBuy ? "0.01" : "0.0001"}
              min="0"
              max={String(max)}
              value={Number.isFinite(amount) ? amount : 0}
              onChange={handleInput}
              className="input-green"
            />
            <input
              type="range"
              min="0"
              max="1"
              step={isBuy ? "0.001" : "0.0001"}
              value={pct}
              onChange={handleSlider}
              className="slider-green"
            />
            <div className="mini-stats">
              <div className="mini-row">
                {isBuy ? "Bank available" : "Shares available"}:{" "}
                <strong>{isBuy ? `$${max.toFixed(2)}` : max.toFixed(4)}</strong>
              </div>
              <div className="mini-row">{helper}</div>
              {price > 0 && <div className="mini-sub">Current price: ${price.toFixed(2)}</div>}
            </div>
          </div>
        </div>

        {error && <div className="error-message" style={{ marginTop: 12 }}>{error}</div>}

        <div className="action-section" style={{ display: "flex", gap: 12 }}>
          <button className="start-button" onClick={submit} disabled={amount <= 0}>
            {isBuy ? "Confirm Buy" : "Confirm Sell"}
          </button>
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function roundTo(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
