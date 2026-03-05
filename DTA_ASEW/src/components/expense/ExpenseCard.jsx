import  { useState } from "react";
import ViewExpenseModal from "../../components/expense/ViewExpenseModal";
const ExpenseCard = ({ expense, user, isAdmin, onEdit }) => {

  const [viewExpense, setViewExpense] = useState(null);
   const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  // Format Date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Category Icon Auto
  const getCategoryIcon = () => {
    if (expense.category?.includes("Food & Beverages")) return "restaurant";
    if (expense.category?.includes("Travelling Allowance")) return "flight_takeoff";
    if (expense.category?.includes("Hotel/Stay")) return "hotel";
    return "receipt_long";
  };

  return (
    <div className="bg-bg-card rounded-2xl overflow-hidden shadow-lg border border-border-main group hover:border-primary/50 transition-all relative">

      {/* Header */}
      <div className="p-4 flex justify-between gap-3">

        {/* Left Info */}
        <div className="flex gap-4 flex-1 min-w-0 pr-24">

          {/* Icon */}
          <div className="size-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-2xl">
              {getCategoryIcon()}
            </span>
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-text-muted font-bold text-xs">
                #{expense.id}
              </span>

              
            </div>

            {/* Category */}
            <h3 className="text-text-main font-bold text-base truncate">
              {expense.category}
            </h3>

            {/* Amount */}
            <p className="text-sm font-extrabold text-primary mt-1">
              ₹{expense.amount}
            </p>

            {/* Employee Info (Admin Only) */}
            {isAdmin && (
              <p className="text-[11px] text-text-muted mt-1 truncate">
                {expense.employee_name} • {expense.email}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-1 bg-bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border-main shadow-sm">

          {/* View */}
          <button
            onClick={() => {
                                setViewExpense(expense);
                                setIsViewModalOpen(true);
                              }}
            className="p-1 text-text-muted hover:text-primary transition"
            title="View Expense"
          >
            <span className="material-symbols-outlined text-xl">
              visibility
            </span>
          </button>

          {/* Edit */}
          {(isAdmin || expense.user_id === user.id) && (
            <button
              onClick={() => onEdit(expense)}
              className="p-1 text-text-muted hover:text-amber-500 transition"
              title="Edit Expense"
            >
              <span className="material-symbols-outlined text-xl">
                edit
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">

        {/* Location */}
        <InfoBlock
          icon="location_on"
          label="Location"
          value={expense.location || "N/A"}
          color="blue"
        />

        {/* Travel Type */}
        <InfoBlock
          icon="commute"
          label="Travel"
          value={expense.travel_type || "None"}
          color="purple"
        />

        {/* KM */}
        <InfoBlock
          icon="route"
          label="KM Travelled"
          value={`${expense.km || 0} km`}
          color="emerald"
        />

        {/* Toll */}
        <InfoBlock
          icon="payments"
          label="Toll Amount"
          value={`₹${expense.toll_amount || 0}`}
          color="red"
        />
      </div>

      {/* Footer */}
      <div className="bg-bg-main/40 px-4 py-3 flex justify-between items-center border-t border-border-main text-xs">

        {/* Submitted */}
        <div>
          <p className="text-[10px] uppercase font-bold text-text-muted">
            Submitted
          </p>
          <p className="text-text-main font-semibold">
            {formatDate(expense.created_at)}
          </p>
        </div>

        {/* Bill Button */}
        {expense.bill_url && (
          <a
            href={expense.bill_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition text-[11px]"
          >
            View Bill 📄
          </a>
        )}
      </div>
      <ViewExpenseModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                expense={viewExpense}
              />
    </div>
  );
};

export default ExpenseCard;





/* Small Reusable Block */
const InfoBlock = ({ icon, label, value, color }) => {
  return (
    <div
      className={`bg-${color}-500/5 rounded-xl p-3 flex items-center gap-3 border border-${color}-500/10`}
    >
      <div
        className={`size-8 rounded-lg bg-${color}-500/10 flex items-center justify-center text-${color}-500`}
      >
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>

      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase text-${color}-500/70`}>
          {label}
        </p>
        <p className="text-text-main font-bold text-sm truncate">{value}</p>
      </div>
    </div>
  );
};
