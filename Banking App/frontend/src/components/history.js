import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function History() {
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

    async function handleReturn() {
        navigate("/accounts");
    }

    return (
    <div>
        {user ? (
        <>
            <h3>Here is the history page!</h3>
            <br />
            <button onClick={handleReturn}>Return to account</button>
        </>
        ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
        ) : (
        <p>Loading user info...</p>
        )}
    </div>
    );

}
