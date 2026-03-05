import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import MainLayout from "../../components/layout/MainLayout";
import CreateExpenseModal from "../../components/expense/CreateExpenseModal";
import ExpenseCard from "../../components/expense/ExpenseCard";
import Loader from "../../components/common/Loader";
import ViewExpenseModal from "../../components/expense/ViewExpenseModal";
import { Eye, Pencil } from "lucide-react";

import { fetchExpenses } from "../../store/slices/expenseSlice";

const Expense = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const { expenses, isLoading } = useSelector((state) => state.expense);

  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";

  // UI States
  const [viewMode, setViewMode] = useState("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  // Category Tabs
  const [activeCategory, setActiveCategory] = useState("ALL");

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch Expenses
  useEffect(() => {
    dispatch(fetchExpenses());
  }, [dispatch]);

  // Visible Expenses
  const visibleExpenses = React.useMemo(() => {
    let data = [...expenses];

    // Employee Only Own
    if (!isAdmin) {
      data = data.filter((e) => e.user_id === user.id);
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (e) =>
          e.employee_name?.toLowerCase().includes(term) ||
          String(e.employee_name).includes(term),
      );
    }

    // Dropdown Category Filter

    if (filterFrom) {
      data = data.filter((e) => new Date(e.created_at) >= new Date(filterFrom));
    }

    if (filterTo) {
      data = data.filter((e) => new Date(e.created_at) <= new Date(filterTo));
    }

    // Category Tabs Filter
    if (activeCategory !== "ALL") {
      data = data.filter((e) => e.category === activeCategory);
    }

    return data;
  }, [
    expenses,
    searchTerm,
    filterFrom,
    filterTo,
    activeCategory,
    isAdmin,
    user,
  ]);

  const totalAmountDisplay = React.useMemo(() => {
    return visibleExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
  }, [visibleExpenses]);

  const exportExpensePDF = () => {
    if (!searchTerm || !filterFrom || !filterTo) {
      toast.error("Select Employee Name + Start & End Date first");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // Helper to format date like 21-Jan-2026
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    // ======= 1. TOP HEADER (RAJIV ASSOCIATES) =======
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin, 10, contentWidth, 10); // Title Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RAJIV ASSOCIATES", pageWidth / 2, 17, { align: "center" });

    // ======= 2. DATE RANGE ROW =======
    doc.rect(margin, 20, contentWidth, 12); // Row box
    doc.line(60, 20, 60, 32); // Vertical separator

    doc.setFontSize(9);
    doc.text("EXPENSES CLAIMED FOR", 12, 25);
    doc.text("DATE RANGE:", 12, 29);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${formatDate(filterFrom)} to ${formatDate(filterTo)}`, 130, 27, { align: "center" });

    // ======= 3. NAME & TOTAL ROW =======
    doc.rect(margin, 32, contentWidth, 25); // Row box
    doc.line(60, 32, 60, 57); // Vertical separator

    // Name Column
    doc.setFontSize(9);
    doc.text("NAME OF", 12, 38);
    doc.text(`EMPLOYEE: ${searchTerm}`, 12, 42, { maxWidth: 45 });

    // Green Total Column
    const totalAmount = visibleExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    doc.setFillColor(34, 139, 34); // Green color
    doc.rect(60.2, 32.2, contentWidth - 50.4, 24.6, "F"); // Fill inside the lines

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(`Total- ${totalAmount}/-`, (60 + pageWidth - margin) / 2, 47, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ======= 4. TABLE SECTION =======
    const tableRows = visibleExpenses.map((e) => [
      formatDate(e.created_at || new Date()),
      e.from_location || "",
      e.to_location || "",
      e.km || "NA",
      e.category === "Travelling Allowance" ? e.amount : "",
      e.category !== "Travelling Allowance" ? e.amount : "",
      e.other_description || e.category,
      "", // Bills column left empty like in SS
    ]);

    autoTable(doc, {
      startY: 57,
      margin: { left: margin, right: margin },
      head: [
        [
          "DATE",
          "FROM",
          "TO",
          "KM",
          "Traveling\nAMT.",
          "Others\nAmount",
          "Discription",
          "Bills",
        ],
      ],
      body: tableRows,
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: "middle",
        halign: "center",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        fontStyle: "bold",
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 12 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { halign: "left" }, // Description left aligned
        7: { cellWidth: 12 },
      },
    });

    // ======= 5. FOOTER SECTION =======
    let finalY = doc.lastAutoTable.finalY + 10;

    // Certification text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      "It is certified that above journies are made by me to perform my office duties.",
      margin + 2,
      finalY
    );

    // Border for the whole footer area to match the SS look
    doc.rect(margin, doc.lastAutoTable.finalY, contentWidth, 80);

    finalY += 15;
    doc.setFontSize(11);
    doc.text("EMPLOYEE'S SIGNATURE :", margin + 2, finalY);

    finalY += 15;
    doc.text("FOR RAJIV ASSOCIATES", margin + 2, finalY);

    finalY += 30;
    doc.setFontSize(9);
    doc.text("(Authorised Signatory)", margin + 2, finalY);

    // ======= SAVE PDF =======
    doc.save(`Expense_Report_${searchTerm}_${filterFrom}_to${filterTo}.pdf`);
  };

  // Sorting Logic
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedExpenses = React.useMemo(() => {
    let items = [...visibleExpenses];

    items.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "created_at") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [visibleExpenses, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);

  const paginatedExpenses = sortedExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset page when filters/tabs change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, activeCategory, filterFrom, filterTo]);

  // Edit Handler
  const handleEdit = (expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterFrom("");
    setFilterTo("");
    setActiveCategory("ALL");
    setCurrentPage(1);

    toast.success("Filters Reset Successfully");
  };

  return (
    <MainLayout title="Expense Management">
      <div className="flex flex-col gap-4 p-3">
        {/* Toolbar */}
        <div className="flex flex-wrap justify-between gap-3 bg-bg-card border border-border-main rounded-xl p-3 shadow-sm">
          {/* View Switch */}
          <div className="flex bg-bg-main rounded-lg p-1">
            {["list", "tiles"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === mode
                  ? "bg-primary text-white shadow-md"
                  : "text-text-muted hover:text-text-main"
                  }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Add Expense */}
            <button
              onClick={() => {
                setExpenseToEdit(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-white px-4 py-2 rounded-lg font-bold shadow-md"
            >
              + Submit Expense
            </button>

            {/* Export PDF */}
            <button
              onClick={exportExpensePDF}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-md"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="bg-bg-card border border-border-main rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              Search
            </label>
            <input
              type="text"
              placeholder="By Employee Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              Start Date
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              End Date
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
            />
          </div>
          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full px-4 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 
    bg-red-500/10 text-red-500 border-red-500/30 
    hover:bg-red-500/20 hover:border-red-500/50 
    transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">
                restart_alt
              </span>
              Reset
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 bg-bg-card border border-border-main rounded-xl p-2 shadow-sm">
          {[
            "ALL",
            "Food & Beverages",
            "Travelling Allowance",
            "Hotel/Stay",
            "Other",
          ].map((cat) => {
            const count =
              cat === "ALL"
                ? expenses.length
                : expenses.filter((e) => e.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${activeCategory === cat
                  ? "bg-primary text-white border-primary shadow-md"
                  : "bg-bg-main text-text-muted border-border-main hover:bg-white/5"
                  }`}
              >
                {cat}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeCategory === cat
                    ? "bg-white/20 text-white"
                    : "bg-bg-card text-text-muted"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <div className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-green-600/10 text-green-600 border border-green-600/30">
            Total Amount : {totalAmountDisplay}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : paginatedExpenses.length === 0 ? (
          <div className="text-center p-12 text-text-muted font-bold">
            No Expenses Found
          </div>
        ) : (
          <>
            {/* TABLE VIEW */}
            {viewMode === "list" && (
              <div className="bg-bg-card  border border-border-main rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-main/40 text-text-muted uppercase text-[10px]">
                      <th
                        className="px-5 py-4 cursor-pointer"
                        onClick={() => handleSort("id")}
                      >
                        ID
                      </th>
                      <th className="px-5 py-4">Employee</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Amount</th>

                      <th className="px-5 py-4">Bill</th>
                      <th className="px-5 py-4">Created</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="border-t border-border-main hover:bg-bg-main/20"
                      >
                        <td className="px-5 py-4 font-bold">#{exp.id}</td>
                        <td className="px-5 py-4">{exp.employee_name}</td>
                        <td className="px-5 py-4">{exp.email}</td>
                        <td className="px-5 py-4">{exp.category}</td>
                        <td className="px-5 py-4 font-semibold">
                          ₹{exp.amount}
                        </td>

                        {/* Bill */}
                        <td className="px-5 py-4">
                          {exp.bill_url ? (
                            <a
                              href={exp.bill_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-bold hover:underline"
                            >
                              View Bill
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </td>

                        {/* Created */}
                        <td className="px-5 py-4 text-xs text-text-muted">
                          {new Date(exp.created_at).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex gap-3 justify-center items-center">
                            {/* View */}
                            <button
                              onClick={() => {
                                setViewExpense(exp);
                                setIsViewModalOpen(true);
                              }}
                              className="flex items-center gap-1 text-primary font-bold hover:underline"
                            >
                              <Eye size={16} />
                              View
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEdit(exp)}
                              className="flex items-center gap-1 text-amber-500 font-bold hover:underline"
                            >
                              <Pencil size={16} />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-border-main text-xs">
                  <p className="text-text-muted font-bold">
                    Showing {(currentPage - 1) * itemsPerPage + 1}–
                    {Math.min(
                      currentPage * itemsPerPage,
                      sortedExpenses.length,
                    )}{" "}
                    of {sortedExpenses.length}
                  </p>

                  <div className="flex gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="px-3 py-1 rounded-lg border disabled:opacity-40"
                    >
                      Prev
                    </button>

                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg border font-bold ${currentPage === page
                            ? "bg-primary text-white border-primary"
                            : "hover:bg-bg-main"
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}

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

            {/* TILE VIEW */}
            {viewMode === "tiles" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    user={user}
                    isAdmin={isAdmin}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <ViewExpenseModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          expense={viewExpense}
        />

        {/* Modal */}
        <CreateExpenseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          expenseToEdit={expenseToEdit}
          onSuccess={() => dispatch(fetchExpenses())}
        />
      </div>
    </MainLayout>
  );
};

export default Expense;
