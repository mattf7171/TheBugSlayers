import React, { useState, useEffect } from "react";

export default function SessionSet() {
    const [status, setStatus] = useState("");

    useEffect(() => {
        async function run() {
            const response = await fetch(`http://localhost:4001/session_set`,
                {
                    method: "GET",
                    credentials: 'include'
                }
            );
            if (!response.ok) {
                const message = `An error occurred: ${response.statusText}`;
                window.alert(message);
                return;
            }
            const statusResponse = await response.json();
            setStatus(statusResponse.status);
        }
        run();
        return;
    }, []);

    return (
        <div>
            <h3>Set Session</h3>
            <p>{status}</p>
            
        </div>
    );
}