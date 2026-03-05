import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import { createVendor, editVendor } from "../../store/slices/vendorsSlice";
import {
  fetchProjects,
  fetchVendorsCategories,
} from "../../store/slices/masterSlice";

/* ============================= */
/* Small Input */
/* ============================= */
const Input = ({ label, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted">
      {label}
    </label>
    <input
      {...props}
      className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
    />
  </div>
);

/* ============================= */
/* Select */
/* ============================= */
const Select = ({ label, children, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted">
      {label}
    </label>
    <select
      {...props}
      className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
    >
      {children}
    </select>
  </div>
);

/* ============================= */
/* MAIN COMPONENT */
/* ============================= */
const CreateVendorsModal = ({
  isOpen,
  onClose,
  vendorToEdit,
  onSuccess,
}) => {
  const dispatch = useDispatch();

  const { isSubmitting } = useSelector((state) => state.vendors);
  const { projects, vendorsCategories } = useSelector(
    (state) => state.master
  );

  const { user } = useSelector((state) => state.auth);

  /* ============================= */
  /* Fetch Dropdown Data */
  /* ============================= */
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchProjects());
      dispatch(fetchVendorsCategories());
    }
  }, [dispatch, isOpen]);

  /* ============================= */
  /* Form State */
  /* ============================= */
  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    location: "",
    address: "",

    contact_person: "",
    contact_number: "",
    profile_name: "",

    categories: [],
    sub_categories: [],
    projects: [],

    suggested_by: user?.name || "Admin",

    website_url: "",
    linkedin_url: "",

    profile_doc_type: "Upload_File",
    profile_doc_value: "",
  });

  const [profileFile, setProfileFile] = useState(null);

  /* ============================= */
  /* Prefill Edit Mode */
  /* ============================= */
  useEffect(() => {
    if (vendorToEdit && isOpen) {
      setFormData({
        ...vendorToEdit,
        categories: vendorToEdit.categories || [],
        sub_categories: vendorToEdit.sub_categories || [],
        projects: vendorToEdit.projects || [],
        suggested_by:
          vendorToEdit.suggested_by || user?.name || "",
      });
    }
  }, [vendorToEdit, isOpen]);

  /* ============================= */
  /* Add Category/SubCategory */
  /* ============================= */
  const addToArray = (key, value) => {
    if (!value) return;

    setFormData((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key]
        : [...prev[key], value],
    }));
  };

  /* ============================= */
  /* Remove Selected Item */
  /* ============================= */
  const removeFromArray = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: prev[key].filter((v) => v !== value),
    }));
  };

  /* ============================= */
  /* Submit */
  /* ============================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = new FormData();

      Object.keys(formData).forEach((key) => {
        if (Array.isArray(formData[key])) {
          payload.append(key, JSON.stringify(formData[key]));
        } else {
          payload.append(key, formData[key]);
        }
      });

      // Upload File
      if (formData.profile_doc_type === "Upload_File" && profileFile) {
        payload.append("profile_doc", profileFile);
      }

      if (vendorToEdit) {
        await dispatch(
          editVendor({
            id: vendorToEdit.id,
            updatedData: payload,
          })
        ).unwrap();
        toast.success("Vendor Updated Successfully");
      } else {
        await dispatch(createVendor(payload)).unwrap();
        toast.success("Vendor Created Successfully");
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  if (!isOpen) return null;

  /* ============================= */
  /* UI */
  /* ============================= */
  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-extrabold">
            {vendorToEdit ? "Edit Vendor" : "Add New Vendor"}
          </h2>

          <button
            onClick={onClose}
            className="size-10 rounded-full hover:bg-bg-main"
          >
            ✖
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-8 max-h-[80vh] overflow-y-auto"
        >
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Company Name *"
              required
              value={formData.company_name}
              onChange={(e) =>
                setFormData({ ...formData, company_name: e.target.value })
              }
            />

            <Input
              label="Email ID *"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />

            <Input
              label="Location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-[11px] font-bold uppercase text-text-muted">
              Address
            </label>
            <textarea
              rows="3"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full mt-1 bg-bg-main border rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) =>
                setFormData({ ...formData, contact_person: e.target.value })
              }
            />

            <Input
              label="Contact Number"
              value={formData.contact_number}
              onChange={(e) =>
                setFormData({ ...formData, contact_number: e.target.value })
              }
            />

            <Input
              label="Profile Name"
              value={formData.profile_name}
              onChange={(e) =>
                setFormData({ ...formData, profile_name: e.target.value })
              }
            />
          </div>

          {/* Category + SubCategory */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Select
              label="Vendor Category"
              onChange={(e) => addToArray("categories", e.target.value)}
            >
              <option value="">Select Category</option>
              {vendorsCategories?.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </Select>

            <Select
              label="Vendor Sub Category"
              onChange={(e) =>
                addToArray("sub_categories", e.target.value)
              }
            >
              <option value="">Select Sub Category</option>
              {vendorsCategories?.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </Select>

            <Input label="Suggested By" value={formData.suggested_by} readOnly />
          </div>

          {/* Selected Tags */}
          <div className="flex flex-wrap gap-2">
            {[...formData.categories, ...formData.sub_categories].map(
              (item, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold flex gap-2 items-center"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      removeFromArray(
                        formData.categories.includes(item)
                          ? "categories"
                          : "sub_categories",
                        item
                      )
                    }
                    className="text-red-500 font-bold"
                  >
                    ✖
                  </button>
                </span>
              )
            )}
          </div>

          {/* Website + LinkedIn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Website URL"
              value={formData.website_url}
              onChange={(e) =>
                setFormData({ ...formData, website_url: e.target.value })
              }
            />

            <Input
              label="LinkedIn URL"
              value={formData.linkedin_url}
              onChange={(e) =>
                setFormData({ ...formData, linkedin_url: e.target.value })
              }
            />
          </div>

          {/* Projects Dropdown Multi Select */}
          <div>
            <Select
              label="Project Names (Multiple Selection)"
              onChange={(e) => addToArray("projects", e.target.value)}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>

            {/* Selected Projects */}
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.projects.map((proj, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-bold flex gap-2 items-center"
                >
                  {proj}
                  <button
                    type="button"
                    onClick={() => removeFromArray("projects", proj)}
                    className="text-red-500 font-bold"
                  >
                    ✖
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Profile Document */}
          <div className="border border-dashed rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">
              Profile Document
            </h3>

            <div className="flex gap-3 mb-4">
              {["Upload_File", "EXTERNAL"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, profile_doc_type: type })
                  }
                  className={`flex-1 py-2 rounded-xl font-bold ${
                    formData.profile_doc_type === type
                      ? "bg-primary text-white"
                      : "bg-bg-main text-text-muted"
                  }`}
                >
                  {type === "Upload_File"
                    ? "Upload to Drive"
                    : "External Link"}
                </button>
              ))}
            </div>

            {formData.profile_doc_type === "Upload_File" ? (
              <input
                type="file"
                onChange={(e) => setProfileFile(e.target.files[0])}
              />
            ) : (
              <Input
                label="External Document Link"
                value={formData.profile_doc_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    profile_doc_value: e.target.value,
                  })
                }
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold"
            >
              {isSubmitting ? "Saving..." : "Save Vendor"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-bg-main font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateVendorsModal;