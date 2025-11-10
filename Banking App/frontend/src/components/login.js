import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import "./login.css"; // Import the CSS file

// Function to login a user
export default function Login() {
    useEffect(() => {
        async function clearSession() {
            try {
                await fetch("http://localhost:4001/session_delete", {
                    method: "GET",
                    credentials: "include",
                });
                console.log("Session cleared on login page.");
            } catch (err) {
                console.error("Failed to clear session:", err);
            }
        }
        clearSession();
    }, []);



    const [form, setForm] = useState({
        userName: "",
        password: "",
    });

    const [error, setError] = useState("");
    const navigate = useNavigate();

    function updateForm(jsonObj) {
        setForm((prev) => ({ ...prev, ...jsonObj }));
        setError(""); // Clear error on input change
    }

    async function onSubmit(e) {
        e.preventDefault();

        const { userName, password } = form;

        try {
            const response = await fetch("http://localhost:4001/record/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userName, password }),
                credentials: "include",
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setError(result.message || "Invalid username or password.");
                return;
            }

            navigate("/accounts"); // Navigate to accounts
        } catch (err) {
            setError("Login failed. Please try again.");
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">Bugslayers Banking</h2>
                <h5 className="login-subtitle">Please enter you Account details to sign in</h5>
                <form onSubmit={onSubmit}>
                <div className="login-form-group">
                    <label className="login-label">Username</label>
                    <input
                    type="text"
                    value={form.userName}
                    onChange={(e) => updateForm({ userName: e.target.value })}
                    required
                    className="login-input"
                    placeholder="Enter your username"
                    />
                </div>
                <div className="login-form-group">
                    <label className="login-label">Password</label>
                    <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateForm({ password: e.target.value })}
                    required
                    className="login-input"
                    placeholder="Enter your password"
                    />
                </div>
                {error && <p className="login-error">{error}</p>}
                <button type="submit" className="login-button">Login</button>
                </form>
                <div className="login-footer">
                <p>New to the bank?</p>
                <button onClick={() => navigate("/register")} className="register-button">
                    Create Account
                </button>
                </div>
            </div>
        </div>
    );
}