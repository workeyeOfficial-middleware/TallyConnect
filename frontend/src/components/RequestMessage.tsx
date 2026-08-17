import { useState } from "react";
import API_BASE from "../api";

export function RequestDetails() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (message.trim().length < 10) {
      setError("Please describe your request (min 10 characters)");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/request-to-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setSuccess("Request sent successfully to admin");
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
      
      {/* MAIN CONTAINER */}
      <div className="w-full max-w-xl lg:max-w-3xl">
        
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 sm:p-6 lg:p-8">

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
              Request Details
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Send your requirement directly to the administrator
            </p>
          </div>

          {/* Alerts */}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-700 text-sm">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Assigned */}
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Assigned To
            </label>
            <div className="mt-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-200 text-sm">
              Admin
            </div>
          </div>

          {/* Input */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Describe your requirement
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="
                w-full mt-2 
                p-3 sm:p-4
                text-sm sm:text-base
                border border-gray-300 dark:border-gray-700
                rounded-lg
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-white
                placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition
                resize-none
              "
              placeholder="Explain what you need... (e.g. access, issue, feature request)"
            />
          </div>

          {/* Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="
              w-full
              py-3
              text-sm sm:text-base
              rounded-lg
              font-medium
              text-white
              bg-blue-600 hover:bg-blue-700
              transition-all
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center
            "
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Sending...
              </span>
            ) : (
              "Submit Request"
            )}
          </button>

        </div>
      </div>
    </div>
  );
}