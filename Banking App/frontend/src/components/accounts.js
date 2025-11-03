import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Accounts() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchSession() {
            try {
                const response = await fetch("http://localhost:4000/session_get", {
                    method: "GET",
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch session.");
                }

                const data = await response.json();
                const match = data.status.match(/Session username is: (\w+)/);

                if (match) {
                    const username = match[1];

                    // Now fetch full user info from DB
                    const userResponse = await fetch(`http://localhost:4000/record`);
                    const allUsers = await userResponse.json();
                    const currentUser = allUsers.find(u => u.userName === username);

                    if (currentUser) {
                        setUser(currentUser);
                    } else {
                        setError("User not found.");
                    }
                } else {
                    setError("No active session.");
                }
            } catch (err) {
                console.error(err);
                setError("Error retrieving user info.");
            }
        }

        fetchSession();
    }, []);

    async function handleLogout() {
        await fetch("http://localhost:4000/session_delete", {
            method: "GET",
            credentials: "include",
        });
        navigate("/");
    }

    async function handleToHistory() {
        navigate("/history");
    }

    return (
    <div>
        {user ? (
        <>
            <h3>Welcome {user.userName}! Here is the Accounts page</h3>
            <table style={{ marginTop: 20 }}>
            <thead>
                <tr>
                <th>Username</th>
                <th>User Type</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                <td>{user.userName}</td>
                <td>{user.userType}</td>
                </tr>
            </tbody>
            </table>
            <br />
            <button onClick={handleToHistory}>Account History</button>
            <button onClick={handleLogout}>Logout</button>
        </>
        ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
        ) : (
        <p>Loading user info...</p>
        )}
    </div>
    );

}
