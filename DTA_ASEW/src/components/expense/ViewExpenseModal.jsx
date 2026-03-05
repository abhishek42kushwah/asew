import React from "react";

const ViewExpenseModal = ({ isOpen, onClose, expense }) => {
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              Expense Details
            </h2>
            <p className="text-[11px] uppercase text-text-muted font-bold tracking-widest">
              #{expense.id} • {expense.category}
            </p>
          </div>

          <button
            onClick={onClose}
            className="size-9 rounded-full hover:bg-bg-main flex items-center justify-center text-text-muted"
          >
            ✖
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Employee" value={expense.employee_name} />
            <Info label="Email" value={expense.email} />
            <Info label="Amount" value={`₹${expense.amount}`} />
            <Info
              label="Created At"
              value={new Date(expense.created_at).toLocaleString()}
            />
          </div>

          {/* Travel Fields */}
          {expense.category === "Travelling Allowance" && (
            <div className="border border-border-main rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-primary text-sm">
                Travel Details
              </h3>

              <Info label="Travel Type" value={expense.travel_type} />
              <Info label="From Location" value={expense.from_location} />
              <Info label="To Location" value={expense.to_location} />
              <Info label="KM Travelled" value={expense.km} />
              <Info label="Toll Amount" value={`₹${expense.toll_amount}`} />
            </div>
          )}

          {/* Hotel Fields */}
          {expense.category === "Hotel/Stay" && (
            <div className="border border-border-main rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-primary text-sm">
                Stay Details
              </h3>

              <Info label="Check In" value={expense.check_in} />
              <Info label="Check Out" value={expense.check_out} />
            </div>
          )}

          {/* Description */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Description / Notes
            </h3>
            <p className="text-sm text-text-muted">
              {expense.other_description || "No Description"}
            </p>
          </div>

          {/* Bill */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Bill Attachment
            </h3>

            {expense.bill_url ? (
              <a
                href={expense.bill_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-bold hover:underline"
              >
                View Uploaded Bill
              </a>
            ) : (
              <p className="text-text-muted text-sm">No Bill Uploaded</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-main">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* Reusable Info Component */
const Info = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase text-text-muted font-bold">
      {label}
    </p>
    <p className="text-sm font-semibold text-text-main">
      {value || "-"}
    </p>
  </div>
);

export default ViewExpenseModal;
