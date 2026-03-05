import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { createExpense, editExpense } from "../../store/slices/expenseSlice";

// ===============================
// UI HELPERS (Moved outside to prevent focus loss)
// ===============================
const Input = ({ label, className, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted tracking-wide">
      {label}
    </label>
    <input
      {...props}
      className={className || "w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm text-text-main font-semibold focus:ring-2 focus:ring-primary/40 outline-none"}
    />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted tracking-wide">
      {label}
    </label>
    <div className="relative mt-1">
      <select
        {...props}
        className="w-full appearance-none bg-bg-main border border-border-main rounded-xl px-3 py-2 pr-10 text-sm text-text-main font-semibold cursor-pointer focus:ring-2 focus:ring-primary/40 outline-none"
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        ▼
      </span>
    </div>
  </div>
);

const CreateExpenseModal = ({ isOpen, onClose, expenseToEdit, onSuccess }) => {
  const dispatch = useDispatch();
  const { isSubmitting } = useSelector((state) => state.expense);

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    location: "",
    travel_type: "",
    from_location: "",
    to_location: "",
    km: "",
    toll_amount: "",
    check_in: "",
    check_out: "",
    other_description: "",
  });

  const [billFile, setBillFile] = useState(null);

  // Helper to format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  // ✅ PREFILL LOGIC
  useEffect(() => {
    if (expenseToEdit && isOpen) {
      setFormData({
        category: expenseToEdit.category || "",
        amount: expenseToEdit.amount || "",
        location: expenseToEdit.location || "",
        travel_type: expenseToEdit.travel_type || "",
        from_location: expenseToEdit.from_location || "",
        to_location: expenseToEdit.to_location || "",
        km: expenseToEdit.km || "",
        toll_amount: expenseToEdit.toll_amount || "",
        // Format dates correctly for the input fields
        check_in: formatDateForInput(expenseToEdit.check_in),
        check_out: formatDateForInput(expenseToEdit.check_out),
        other_description: expenseToEdit.other_description || "",
      });
    } else if (!expenseToEdit && isOpen) {
      // Reset form if opening in "Create" mode
      // eslint-disable-next-line react-hooks/immutability
      resetForm();
    }
  }, [expenseToEdit, isOpen]);

  // ✅ AUTO-CALCULATION LOGIC FOR TRAVELLING ALLOWANCE
  useEffect(() => {
    if (formData.category === "Travelling Allowance") {
      let rate = 0;
      if (formData.travel_type === "Self Car (9rs/KM)") rate = 9;
      else if (formData.travel_type === "Self Bike (5rs/KM)") rate = 5;

      if (rate > 0) {
        const kmAmount = Number(formData.km || 0) * rate;
        const total = kmAmount + Number(formData.toll_amount || 0);
        setFormData((prev) => ({ ...prev, amount: total.toString() }));
      }
    }
  }, [formData.category, formData.travel_type, formData.km, formData.toll_amount]);

  const resetForm = () => {
    setFormData({
      category: "",
      amount: "",
      location: "",
      travel_type: "",
      from_location: "",
      to_location: "",
      km: "",
      toll_amount: "",
      check_in: "",
      check_out: "",
      other_description: "",
    });
    setBillFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });

    if (billFile) {
      data.append("bill", billFile);
    }

    try {
      if (expenseToEdit) {
        await dispatch(
          editExpense({
            id: expenseToEdit.id,
            updatedData: data,
          })
        ).unwrap();
        toast.success("Expense Updated Successfully");
      } else {
        await dispatch(createExpense(data)).unwrap();
        toast.success("Expense Submitted Successfully");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-border-main flex justify-between items-center bg-bg-main/30">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              {expenseToEdit ? "Edit Expense" : "Submit Expense"}
            </h2>
            <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest">
              Expense Request Form
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full hover:bg-bg-main flex items-center justify-center text-text-muted"
          >
            ✖
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select
              label="Expense Category"
              value={formData.category}
              required
              onChange={(e) => {
                const selected = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  category: selected,
                  // Only reset specific fields if category changes to something else
                  ...(selected !== "Travelling Allowance" && {
                    travel_type: "",
                    from_location: "",
                    to_location: "",
                    km: "",
                    toll_amount: "",
                  }),
                  ...(selected !== "Hotel/Stay" && {
                    check_in: "",
                    check_out: "",
                  }),
                }));
              }}
            >
              <option value="">Select Category</option>
              <option value="Food & Beverages">Food & Beverages</option>
              <option value="Travelling Allowance">Travelling Allowance</option>
              <option value="Hotel/Stay">Hotel/Stay</option>
              <option value="Other">Other</option>
            </Select>

            {formData.category !== "Travelling Allowance" && (
              <Input
                label="Amount (₹)"
                type="number"
                required
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            )}
          </div>

          <Input
            label="Location"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
          />

          {formData.category === "Travelling Allowance" && (
            <div className="space-y-5">
              <Select
                label="Nature of Travel"
                value={formData.travel_type}
                required
                onChange={(e) =>
                  setFormData({ ...formData, travel_type: e.target.value })
                }
              >
                <option value="">-- Select --</option>
                <option value="Self Car (9rs/KM)">Self Car (9rs/KM)</option>
                <option value="Self Bike (5rs/KM)">Self Bike (5rs/KM)</option>
                <option value="Taxi/Cab">Taxi/Cab</option>
                <option value="Public Transport">Public Transport</option>
              </Select>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="From Location"
                  value={formData.from_location}
                  onChange={(e) =>
                    setFormData({ ...formData, from_location: e.target.value })
                  }
                />
                <Input
                  label="To Location"
                  value={formData.to_location}
                  onChange={(e) =>
                    setFormData({ ...formData, to_location: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="KM Travelled"
                  type="number"
                  value={formData.km}
                  onChange={(e) =>
                    setFormData({ ...formData, km: e.target.value })
                  }
                />
                <Input
                  label="Toll Amount (₹)"
                  type="number"
                  value={formData.toll_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, toll_amount: e.target.value })
                  }
                />
              </div>

             

              <Input
                label="Total Amount (₹)"
                type="number"
                required
                value={formData.amount}
                readOnly={
                  formData.travel_type === "Self Car (9rs/KM)" ||
                  formData.travel_type === "Self Bike (5rs/KM)"
                }
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`w-full mt-1 border border-border-main rounded-xl px-3 py-2 text-sm font-semibold outline-none ${formData.travel_type === "Self Car (9rs/KM)" ||
                  formData.travel_type === "Self Bike (5rs/KM)"
                  ? "bg-bg-main/50 text-text-muted cursor-not-allowed"
                  : "bg-bg-main text-text-main focus:ring-2 focus:ring-primary/40"
                  }`}
              />
            </div>
          )}

          {formData.category === "Hotel/Stay" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Check In"
                type="datetime-local"
                value={formData.check_in}
                onChange={(e) =>
                  setFormData({ ...formData, check_in: e.target.value })
                }
              />
              <Input
                label="Check Out"
                type="datetime-local"
                value={formData.check_out}
                onChange={(e) =>
                  setFormData({ ...formData, check_out: e.target.value })
                }
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase text-text-muted">
              Description / Notes
            </label>
            <textarea
              rows="3"
              value={formData.other_description}
              onChange={(e) =>
                setFormData({ ...formData, other_description: e.target.value })
              }
              className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm text-text-main resize-none outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-text-muted">
              Upload Bill
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setBillFile(e.target.files[0])}
              className="w-full mt-2 text-sm text-text-muted"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-bg-main text-text-muted font-bold hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : expenseToEdit
                  ? "Update Expense"
                  : "Submit Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExpenseModal;