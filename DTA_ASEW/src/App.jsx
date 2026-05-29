import React, { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import "./App.css";
import QuotationForm from "./components/QuotationForm";

function App() {
  return (
    <div className="App">
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#333",
            color: "#fff",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          },
          success: {
            iconTheme: {
              primary: "#2ecc71",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#e74c3c",
              secondary: "#fff",
            },
          },
        }}
      />
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <QuotationForm />
      </Suspense>
    </div>
  );
}

export default App;
