import React from "react";
import { useDispatch } from "react-redux";
import { FaUser } from "react-icons/fa";
import { useFormik } from "formik";
import * as Yup from "yup";
import { createCustomer } from "../store/slices/customerSlice";
import toast from "react-hot-toast";

const CustomerModal = ({ isOpen, onClose, onSuccess }) => {
  const dispatch = useDispatch();

  const validationSchema = Yup.object({
    Customer_Name: Yup.string()
      .required("Customer Name is required")
      .min(3, "Name must be at least 3 characters"),
    Email_Address: Yup.string().email("Invalid email address"),
    Contact_Mobile: Yup.string().matches(
      /^[0-9]{10}$/,
      "Mobile number must be 10 digits",
    ),
    GSTIN_UIN: Yup.string().matches(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format",
    ),
    Delivery_Address: Yup.string(),
  });

  const formik = useFormik({
    initialValues: {
      Customer_Name: "",
      Buyer_Address: "",
      GSTIN_UIN: "",
      PAN_No: "",
      Contact_Person: "",
      Email_Address: "",
      Contact_Mobile: "",
      Delivery_Address: "",
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const resultAction = await dispatch(createCustomer(values));

        if (createCustomer.fulfilled.match(resultAction)) {
          toast.success("Customer created successfully!");
          onSuccess(values.Customer_Name);
          resetForm();
          onClose();
        } else {
          toast.error(resultAction.payload || "Failed to create customer");
        }
      } catch {
        toast.error("An unexpected error occurred");
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (!isOpen) return null;

  const inputClass = (name) =>
    `p-2.5 px-4 border rounded-md text-sm sm:text-base bg-white transition-all focus:outline-none w-full ${
      formik.touched[name] && formik.errors[name]
        ? "border-red-500 focus:border-red-500 bg-red-50/10"
        : "border-gray-200 focus:border-[#2ecc71]"
    }`;

  const errorMsg = (name) =>
    formik.touched[name] &&
    formik.errors[name] && (
      <div className="text-red-500 text-xs mt-1">{formik.errors[name]}</div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      {/* Modal */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#6c5ce7] p-3 sm:p-4 text-white flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <FaUser /> Add New Customer
          </h2>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={formik.handleSubmit}
          className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Customer Name *
              </label>
              <textarea
                {...formik.getFieldProps("Customer_Name")}
                className={`${inputClass("Customer_Name")} min-h-[80px]`}
              />
              {errorMsg("Customer_Name")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Delivery Address
              </label>
              <textarea
                {...formik.getFieldProps("Delivery_Address")}
                className={`${inputClass("Delivery_Address")} min-h-[80px]`}
              />
              {errorMsg("Delivery_Address")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                GSTIN/UIN
              </label>
              <input
                type="text"
                {...formik.getFieldProps("GSTIN_UIN")}
                className={inputClass("GSTIN_UIN")}
              />
              {errorMsg("GSTIN_UIN")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                PAN No.
              </label>
              <input
                type="text"
                {...formik.getFieldProps("PAN_No")}
                className={inputClass("PAN_No")}
              />
              {errorMsg("PAN_No")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Contact Person
              </label>
              <input
                type="text"
                {...formik.getFieldProps("Contact_Person")}
                className={inputClass("Contact_Person")}
              />
              {errorMsg("Contact_Person")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Email Address
              </label>
              <input
                type="email"
                {...formik.getFieldProps("Email_Address")}
                className={inputClass("Email_Address")}
              />
              {errorMsg("Email_Address")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Contact Mobile
              </label>
              <input
                type="text"
                {...formik.getFieldProps("Contact_Mobile")}
                className={inputClass("Contact_Mobile")}
              />
              {errorMsg("Contact_Mobile")}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-600">
                Buyer Address
              </label>
              <textarea
                {...formik.getFieldProps("Buyer_Address")}
                className={`${inputClass("Buyer_Address")} min-h-[80px] sm:min-h-[100px]`}
              />
              {errorMsg("Buyer_Address")}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md text-gray-600 font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={formik.isSubmitting}
              className={`w-full sm:w-auto px-6 py-2 bg-[#2ecc71] text-white rounded-md font-semibold ${
                formik.isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-[#27ae60]"
              }`}
            >
              {formik.isSubmitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
