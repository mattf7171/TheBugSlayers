import React, { useEffect, useState } from "react";
import "./accounts.css";

/**
 * Bottom-right toast that slides in & fades out smoothly.
 * Usage:
 *   const [toast, setToast] = useState("");
 *   <Toast message={toast} onClose={() => setToast("")} duration={3000} />
 *   setToast("Transfer complete!");
 */
export default function Toast({ message, onClose, duration = 3000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);

    const t1 = setTimeout(() => setVisible(false), duration);      // start hide
    const t2 = setTimeout(() => onClose && onClose(), duration + 320); // remove node after animation
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [message, duration, onClose]);

  if (!message) return null;
  return <div className={`toast ${visible ? "show" : "hide"}`}>{message}</div>;
}
