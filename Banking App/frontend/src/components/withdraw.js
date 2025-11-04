import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./withdraw.css";

export default function Withdraw() {
    const [amount, setAmount] = useState("");
    const [account, setAccount] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [newCategory, setNewCategory] = useState("");
    const [showCategoryModal, setShowCategoryModal] = useState(false);
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
                if (accountsData.length > 0) setAccount(accountsData[0].accountNumber.toString());
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

        try {
            const response = await fetch("http://localhost:5001/banking/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    accountNumber: parseInt(account),
                    amount: parseFloat(amount),
                    category: category || "general",
                    description
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully withdrew $${amount} from account!`);
                setAmount("");
                setDescription("");
                await fetchAccounts(); 
            } else {
                setError(data.error || "Withdrawal failed");
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
                <h2>Make Withdrawal</h2>
                
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Amount to Withdraw:</label>
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
                        <label>Account:</label>
                        <select value={account} onChange={(e) => setAccount(e.target.value)} required>
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

                    <button type="submit" className="submit-btn">Withdraw Money</button>
                </form>

                <button onClick={() => navigate("/accounts")} className="back-btn">
                    Back to Accounts
                </button>
            </div>

            {}
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