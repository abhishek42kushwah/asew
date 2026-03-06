import React, { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import "./App.css";
import QuotationForm from "./components/QuotationForm";

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" reverseOrder={false} />
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <QuotationForm />
      </Suspense>
    </div>
  );
}

export default App;
