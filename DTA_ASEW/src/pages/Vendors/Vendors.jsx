import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import MainLayout from "../../components/layout/MainLayout";
import CreateVendorsModal from "../../components/vendors/CreateVendorsModal";
import ViewVendorsModal from "../../components/vendors/ViewVendorsModal";
import VendorsCard from "../../components/vendors/VendorsCard";
import Loader from "../../components/common/Loader";

import { Eye, Pencil, Download } from "lucide-react";

import { fetchVendors } from "../../store/slices/vendorsSlice";

const Vendors = () => {
  const dispatch = useDispatch();

  /* ===============================
     ✅ Redux Vendors State
  =============================== */
  const { vendorList = [], isLoading } = useSelector((state) => state.vendors);

  /* ===============================
     ✅ UI States
  =============================== */
  const [viewMode, setViewMode] = useState("list");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState(null);

  const [viewVendor, setViewVendor] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  /* ===============================
     ✅ Search Filter
  =============================== */
  const [searchTerm, setSearchTerm] = useState("");

  /* ===============================
     ✅ Pagination
  =============================== */
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  /* ===============================
     ✅ Fetch Vendors Data
  =============================== */
  useEffect(() => {
    dispatch(fetchVendors());
  }, [dispatch]);

  /* ===============================
     ✅ SAFE FILTERED VENDORS
  =============================== */
  const filteredVendors = React.useMemo(() => {
    let data = Array.isArray(vendorList) ? vendorList.filter(Boolean) : [];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      data = data.filter((v) => {
        if (!v) return false;

        return (
          v.vendor_id?.toLowerCase().includes(term) ||
          v.company_name?.toLowerCase().includes(term) ||
          v.location?.toLowerCase().includes(term) ||
          v.contact_person?.toLowerCase().includes(term) ||
          v.email?.toLowerCase().includes(term) ||
          (Array.isArray(v.categories) &&
            v.categories.some((cat) => cat.toLowerCase().includes(term))) ||
          (Array.isArray(v.projects) &&
            v.projects.some((proj) => proj.toLowerCase().includes(term)))
        );
      });
    }

    return data;
  }, [vendorList, searchTerm]);

  /* ===============================
     ✅ Pagination Logic
  =============================== */
  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);

  const paginatedVendors = filteredVendors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset Page when Search Changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  /* ===============================
     ✅ Edit Handler
  =============================== */
  const handleEdit = (vendor) => {
    setVendorToEdit(vendor);
    setIsModalOpen(true);
  };

  /* ===============================
     ✅ EXPORT TO CSV FUNCTION
  =============================== */
  const exportToCSV = () => {
    if (filteredVendors.length === 0) return;

    const headers = [
      "Vendor ID",
      "Company Name",
      "Email",
      "Location",
      "Address",
      "Contact Person",
      "Contact Number",
      "Categories",
      "Projects",
      "Created At",
    ];

    const rows = filteredVendors.map((v) => [
      v.vendor_id || "",
      v.company_name || "",
      v.email || "",
      v.location || "",
      v.address || "",
      v.contact_person || "",
      v.contact_number || "",
      Array.isArray(v.categories) ? v.categories.join(" | ") : "",
      Array.isArray(v.projects) ? v.projects.join(" | ") : "",
      v.created_at ? new Date(v.created_at).toLocaleString() : "",
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell)}"`).join(","))
        .join("\n");

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "vendors_export.csv");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ===============================
     ✅ UI Render
  =============================== */
  return (
    <MainLayout title="Vendor Management">
      <div className="flex flex-col gap-4 p-3">

        {/* ===============================
            ✅ Toolbar
        =============================== */}
        <div className="flex flex-wrap justify-between gap-3 bg-bg-card rounded-xl p-3">

          {/* View Toggle */}
          <div className="flex bg-bg-main rounded-lg p-1">
            {["list", "tiles"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${
                  viewMode === mode
                    ? "bg-primary text-white"
                    : "text-text-muted"
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Search + Export + Add */}
          <div className="flex gap-3 flex-wrap items-end">

            {/* Search */}
            <div>
              <label className="text-[10px] font-bold uppercase">
                Search Vendor
              </label>
              <input
                type="text"
                placeholder="Company, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 border border-border-main rounded-xl px-3 py-2 w-[250px]"
              />
            </div>

            {/* Export */}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl font-bold"
            >
              <Download size={16} />
              Export CSV
            </button>

            {/* Add Vendor */}
            <button
              onClick={() => {
                setVendorToEdit(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-white px-5 py-2 rounded-xl font-bold"
            >
              + Create Vendor
            </button>
          </div>
        </div>

        {/* ===============================
            ✅ Loading / Empty
        =============================== */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : paginatedVendors.length === 0 ? (
          <div className="text-center p-12 text-gray-500 font-bold">
            No Vendors Found
          </div>
        ) : (
          <>
            {/* ===============================
                ✅ TABLE VIEW
            =============================== */}
            {viewMode === "list" && (
              <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden">

                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-main/40 text-[10px] uppercase">
                      <th className="px-5 py-4">Vendor ID</th>
                      <th className="px-5 py-4">Company</th>
                      <th className="px-5 py-4">Location</th>
                      <th className="px-5 py-4">Categories</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedVendors.map((vendor) => (
                      <tr
                        key={vendor?.id || vendor?.vendor_id}
                        className="border-t border-border-main hover:bg-bg-main/20"
                      >
                        <td className="px-5 py-4 font-bold">
                          {vendor?.vendor_id || "N/A"}
                        </td>

                        <td className="px-5 py-4">
                          {vendor?.company_name || "N/A"}
                        </td>

                        <td className="px-5 py-4">
                          {vendor?.location || "N/A"}
                        </td>

                        {/* Categories List */}
                        <td className="px-5 py-4 text-xs">
                          {Array.isArray(vendor?.categories) &&
                          vendor.categories.length > 0 ? (
                            <ul className="list-disc ml-4 space-y-1">
                              {vendor.categories.slice(0, 3).map((cat, i) => (
                                <li key={i}>{cat}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-text-muted">N/A</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => {
                                setViewVendor(vendor);
                                setIsViewModalOpen(true);
                              }}
                              className="text-primary font-bold"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={() => handleEdit(vendor)}
                              className="text-amber-500 font-bold"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ===============================
                    ✅ Pagination Footer
                =============================== */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-border-main text-xs">

                  {/* Page Info */}
                  <p className="text-text-muted font-bold">
                    Showing {(currentPage - 1) * itemsPerPage + 1}–
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredVendors.length
                    )}{" "}
                    of {filteredVendors.length}
                  </p>

                  {/* Buttons */}
                  <div className="flex gap-2 items-center">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="px-3 py-1 rounded-lg border disabled:opacity-40"
                    >
                      Prev
                    </button>

                   <span className="px-3 py-1 rounded-lg  bg-primary border border-border-main font-bold ">
  {currentPage}
</span>


                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1 rounded-lg border disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================
                ✅ TILE VIEW
            =============================== */}
            {viewMode === "tiles" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedVendors.map((vendor) => (
                  <VendorsCard
                    key={vendor?.id || vendor?.vendor_id}
                    vendor={vendor}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* View Modal */}
        <ViewVendorsModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          vendor={viewVendor}
        />

        {/* Create/Edit Modal */}
        <CreateVendorsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          vendorToEdit={vendorToEdit}
          onSuccess={() => dispatch(fetchVendors())}
        />
      </div>
    </MainLayout>
  );
};

export default Vendors;
