import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './transfer.css';
export default function Transfer() {
    const [amount, setAmount] = useState("");
    const [fromAccount, setFromAccount] = useState("");
    const [toAccount, setToAccount] = useState("");
    const [toUsername, setToUsername] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [newCategory, setNewCategory] = useState("");
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [transferToOtherUser, setTransferToOtherUser] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchAccounts();
        fetchCategories();
    }, []);

    async function fetchAccounts() {
        try {
            const response = await fetch("http://localhost:5001/banking/accounts", {
                credentials: "include"
            });
            if (response.ok) {
                const accountsData = await response.json();
                setAccounts(accountsData);
                if (accountsData.length > 0) {
                    setFromAccount(accountsData[0].accountNumber.toString());
                    setToAccount(accountsData[1]?.accountNumber.toString() || accountsData[0].accountNumber.toString());
                }
            }
        } catch (error) {
            setError("Failed to load accounts");
        }
    }

    async function fetchCategories() {
        try {
            const response = await fetch("http://localhost:5001/banking/categories", {
                credentials: "include"
            });
            if (response.ok) {
                setCategories(await response.json());
            }
        } catch (error) {
            console.error("Failed to load categories");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!amount || amount <= 0) {
            setError("Please enter a valid amount");
            return;
        }

        if (fromAccount === toAccount && !transferToOtherUser) {
            setError("Cannot transfer to the same account");
            return;
        }

        try {
            const response = await fetch("http://localhost:5001/banking/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    fromAccountNumber: parseInt(fromAccount),
                    toAccountNumber: parseInt(toAccount),
                    toUsername: transferToOtherUser ? toUsername : undefined,
                    amount: parseFloat(amount),
                    category: category || "transfer",
                    description
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully transferred $${amount}!`);
                setAmount("");
                setDescription("");
                setToUsername("");
                await fetchAccounts();
            } else {
                setError(data.error || "Transfer failed");
            }
        } catch (error) {
            setError("Network error. Please try again.");
        }
    }

    async function createCategory() {
        if (!newCategory.trim()) return;

        try {
            const response = await fetch("http://localhost:5001/banking/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: newCategory })
            });

            if (response.ok) {
                setNewCategory("");
                setShowCategoryModal(false);
                await fetchCategories();
            }
        } catch (error) {
            setError("Failed to create category");
        }
    }

    return (
        <div className="page-container">
            <div className="form-card">
                <h2>Transfer Funds</h2>
                
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Amount to Transfer:</label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>From Account:</label>
                        <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} required>
                            <option value="">Select Account</option>
                            {accounts.map(acc => (
                                <option key={acc.accountNumber} value={acc.accountNumber}>
                                    {acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1)} 
                                    {acc.accountName ? ` - ${acc.accountName}` : ''} 
                                    (${acc.balance.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={transferToOtherUser}
                                onChange={(e) => setTransferToOtherUser(e.target.checked)}
                            />
                            Transfer to a different user?
                        </label>
                    </div>

                    {transferToOtherUser ? (
                        <>
                            <div className="form-group">
                                <label>To User ID:</label>
                                <input
                                    type="text"
                                    value={toUsername}
                                    onChange={(e) => setToUsername(e.target.value)}
                                    placeholder="Enter recipient's username"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>To Account Number (1, 2, or 3):</label>
                                <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} required>
                                    <option value="1">1 - Checking</option>
                                    <option value="2">2 - Savings</option>
                                    <option value="3">3 - Other</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label>To Account:</label>
                            <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} required>
                                <option value="">Select Account</option>
                                {accounts
                                    .filter(acc => acc.accountNumber.toString() !== fromAccount)
                                    .map(acc => (
                                        <option key={acc.accountNumber} value={acc.accountNumber}>
                                            {acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1)} 
                                            {acc.accountName ? ` - ${acc.accountName}` : ''} 
                                            (${acc.balance.toFixed(2)})
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Category:</label>
                        <div className="category-row">
                            <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <button 
                                type="button" 
                                className="category-add-btn"
                                onClick={() => setShowCategoryModal(true)}
                            >
                                + New Category
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Description (Optional):</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter description"
                        />
                    </div>

                    <button type="submit" className="submit-btn">Transfer Money</button>
                </form>

                <button onClick={() => navigate("/accounts")} className="back-btn">
                    Back to Accounts
                </button>
            </div>

            {/* category creation modal */}
            {showCategoryModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Create New Category</h3>
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Enter category name"
                            className="modal-input"
                        />
                        <div className="modal-actions">
                            <button onClick={createCategory} className="modal-confirm">
                                Create
                            </button>
                            <button onClick={() => setShowCategoryModal(false)} className="modal-cancel">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}