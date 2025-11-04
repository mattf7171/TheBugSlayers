import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./accounts.css";

export default function Accounts() {
    const [user, setUser] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchUserAndAccounts();
    }, []);

    async function fetchUserAndAccounts() {
        try {
            // fetch user session
            const response = await fetch("http://localhost:5001/session_get", {
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

                // fetch user info from DB
                const userResponse = await fetch(`http://localhost:5001/record`);
                const allUsers = await userResponse.json();
                const currentUser = allUsers.find(u => u.userName === username);

                if (currentUser) {
                    setUser(currentUser);
                    await loadAccountsData();
                    await fetchRecentTransactions();
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

    // load account data
    async function loadAccountsData() {
        try {
            const response = await fetch("http://localhost:5001/banking/accounts", {
                method: "GET",
                credentials: "include",
            });
            
            if (response.ok) {
                const accountsData = await response.json();
                setAccounts(accountsData);
            } else {
                // fallback to mock data if banking API not available
                setAccounts([
                    { accountType: "savings", balance: 2500.00, accountNumber: 1 },
                    { accountType: "checking", balance: 1500.50, accountNumber: 2 },
                    { accountType: "other", accountName: "Investment", balance: 5000.75, accountNumber: 3 }
                ]);
            }
        } catch (error) {
            console.log("Using mock account data");
            setAccounts([
                { accountType: "savings", balance: 2500.00, accountNumber: 1 },
                { accountType: "checking", balance: 1500.50, accountNumber: 2 },
                { accountType: "other", accountName: "Investment", balance: 5000.75, accountNumber: 3 }
            ]);
        }
    }

    // fetch recent transactions from backend
    async function fetchRecentTransactions() {
        try {
            const response = await fetch("http://localhost:5001/banking/transactions", {
                method: "GET",
                credentials: "include",
            });
            
            if (response.ok) {
                const transactionsData = await response.json();
                // get 3 most recent transactions
                const recentTransactions = transactionsData.slice(0, 3);
                setTransactions(recentTransactions);
            } else {
                console.log("No transactions found or banking API not available");
                setTransactions([]);
            }
        } catch (error) {
            console.log("Failed to fetch transactions:", error);
            setTransactions([]);
        }
    }

    // format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // get display amount with + or - sign
    function getDisplayAmount(transaction) {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'deposit') {
            return `+$${amount.toFixed(2)}`;
        } else if (transaction.type === 'withdrawal') {
            return `-$${amount.toFixed(2)}`;
        } else if (transaction.type === 'transfer') {
            // For transfers, show negative if it's an outgoing transfer
            return `-$${amount.toFixed(2)}`;
        }
        return `$${amount.toFixed(2)}`;
    }

    // get account name from account number
    function getAccountName(accountNumber) {
        const account = accounts.find(acc => acc.accountNumber === accountNumber);
        if (account) {
            return getAccountDisplayName(account);
        }
        return `Account ${accountNumber}`;
    }

    async function handleLogout() {
        await fetch("http://localhost:5001/session_delete", {
            method: "GET",
            credentials: "include",
        });
        navigate("/");
    }

    function getAccountDisplayName(account) {
        if (account.accountType === "other" && account.accountName) {
            return account.accountName;
        }
        return account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1) + " Account";
    }

    return (
        <div className="accounts-container">
            {user ? (
                <div className="accounts-card">
                    {/* header section */}
                    <div className="accounts-header">
                        <h2>Welcome {user.userName}!</h2>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>

                    {/* account summary */}
                    <div className="account-summary">
                        <h3>Account Summary</h3>
                        <div className="accounts-grid">
                            {accounts.map(account => (
                                <div key={account.accountNumber} className="account-card">
                                    <h4>{getAccountDisplayName(account)}</h4>
                                    <p className="account-balance">${account.balance.toFixed(2)}</p>
                                    <p className="account-number">Account #{account.accountNumber}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* quick actions */}
                    <div className="quick-actions">
                        <h3>Quick Actions</h3>
                        <div className="action-buttons">
                            <button 
                                onClick={() => navigate("/deposit")} 
                                className="action-btn deposit-btn"
                            >
                                Make Deposit
                            </button>
                            <button 
                                onClick={() => navigate("/withdraw")} 
                                className="action-btn withdraw-btn"
                            >
                                Make Withdrawal
                            </button>
                            <button
                                onClick={() => navigate("/transfer")} 
                                className="action-btn transfer-btn"
                            >
                                Transfer Funds
                            </button>
                        </div>
                    </div>

                    {/* most recent transactions */}
                    <div className="recent-transactions">
                        <h3>Recent Transactions</h3>
                        <div className="transactions-list">
                            {transactions.length > 0 ? (
                                transactions.map((transaction, index) => (
                                    <div key={index} className="transaction-item">
                                        <span className={`transaction-type ${transaction.type}`}>
                                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                        </span>
                                        <span className={`transaction-amount ${
                                            transaction.type === 'deposit' ? 'positive' : 'negative'
                                        }`}>
                                            {getDisplayAmount(transaction)}
                                        </span>
                                        <span className="transaction-date">
                                            {formatDate(transaction.timestamp || transaction.createdAt)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="no-transactions">
                                    <p>No recent transactions</p>
                                    <p className="transaction-subtext">Your transactions will appear here</p>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => navigate("/history")} 
                            className="view-history-btn"
                        >
                            View Full History
                        </button>
                    </div>
                </div>
            ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
            ) : (
                <p>Loading user info...</p>
            )}
        </div>
    );
}