import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import "./accounts.css";

const API = "http://localhost:4001";

export default function Layout() {
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  async function logout() {
    try {
      await fetch(`${API}/session_delete`, { method: "GET", credentials: "include" });
    } catch (_) { /* ignore */ }
    navigate("/"); // back to login
  }

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">
          <Link to="/accounts" className="nav-brand">🐞 Bugslayers Banking</Link>

          <div className="nav-links">
            <NavLink to="/accounts" className={linkClass}>Accounts</NavLink>
            <NavLink to="/deposit-withdraw" className={linkClass}>Deposit/Withdraw</NavLink>
            <NavLink to="/transfer" className={linkClass}>Transfer</NavLink>
            <NavLink to="/history" className={linkClass}>History</NavLink>

            <button className="nav-button danger" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      {/* page content */}
      <Outlet />
    </>
  );
}
