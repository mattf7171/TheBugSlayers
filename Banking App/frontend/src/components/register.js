import React, { useState } from "react";
import { useNavigate } from "react-router";
import "./register.css";

// Register a component
export default function Register() {
    const [form, setForm] = useState({
        userName: "",
        password: "",
        confirmPassword: "",
        userType: "",
    });

    const [error, setError] = useState("");
    const navigate = useNavigate();

    function updateForm(jsonObj) {
        setForm((prev) => ({ ...prev, ...jsonObj }));
        setError(""); // Clear error on input change
    }

    async function onSubmit(e) {
        e.preventDefault();

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (form.password.length < 7) {
            setError("Password must be at least 7 characters long.");
            return;
        }

        const { userName, password, userType } = form;
        const newPerson = { userName, password, userType };

        try {
            // Step 1: Register the user
            const registerRes = await fetch("http://localhost:4001/record/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPerson),
            });

            if (!registerRes.ok) {
                const errorData = await registerRes.json();
                setError(errorData.message || "Registration failed.");
                return;
            }

            // Step 2: Log the user in to set session
            const loginRes = await fetch("http://localhost:4001/record/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userName, password }),
                credentials: "include",
            });

            const loginData = await loginRes.json();

            if (!loginRes.ok || !loginData.success) {
                setError("Login after registration failed.");
                return;
            }

            setForm({ userName: "", password: "", confirmPassword: "", userType: "" });
            navigate("/accounts");
        } catch (error) {
            console.error("Registration error:", error);
            setError("Something went wrong. Please try again.");
        }
    }


    return (
        <div className="register-container">
            <div className="register-card">
                <h2 className="register-title">Create Account</h2>
                <p className="register-subtitle">Join our banking platform</p>
                <form onSubmit={onSubmit}>
                    <div className="register-form-group">
                        <label className="register-label">Username</label>
                        <input
                            type="text"
                            className="register-input"
                            value={form.userName}
                            onChange={(e) => updateForm({ userName: e.target.value })}
                            required
                        />
                    </div>
                    <div className="register-form-group">
                        <label className="register-label">Password</label>
                        <input
                            type="password"
                            className="register-input"
                            value={form.password}
                            onChange={(e) => updateForm({ password: e.target.value })}
                            required
                        />
                    </div>
                    <div className="register-form-group">
                        <label className="register-label">Re-enter Password</label>
                        <input
                            type="password"
                            className="register-input"
                            value={form.confirmPassword}
                            onChange={(e) => updateForm({ confirmPassword: e.target.value })}
                            required
                        />
                    </div>
                    {error && <p className="register-error">{error}</p>}
                    <button type="submit" className="register-user-button">Register</button>
                </form>
                <div className="register-footer">
                    <p>Already have an account?</p>
                    <button onClick={() => navigate("/")} className="login-link-button">
                    Login
                    </button>
                </div>
            </div>
        </div>
    );

}