import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import MainLayout from "../../components/layout/MainLayout";
import CreateMomModal from "../../components/mom/CreateMomModal";
import ViewMomModal from "../../components/mom/ViewMomModal";
import MomCard from "../../components/mom/MomCard";
import Loader from "../../components/common/Loader";

import { Eye, Pencil } from "lucide-react";

import { fetchMOM } from "../../store/slices/momSlice";

const Mom = () => {
  const dispatch = useDispatch();

  // ✅ MOM State
  const { momList, isLoading } = useSelector((state) => state.mom);

  // UI States
  const [viewMode, setViewMode] = useState("list");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [momToEdit, setMomToEdit] = useState(null);

  const [viewMom, setViewMom] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // ✅ Dropdown Filter
  const [selectedProject, setSelectedProject] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ Fetch MOM Data
  useEffect(() => {
    dispatch(fetchMOM());
  }, [dispatch]);

  // ✅ Unique Project List for Dropdown
  const projectOptions = React.useMemo(() => {
    if (!Array.isArray(momList)) return ["ALL"];

    const projects = momList.filter((m) => m?.project).map((m) => m.project);

    return ["ALL", ...new Set(projects)];
  }, [momList]);

  // ✅ Filter MOM by Selected Project
  const filteredMom = React.useMemo(() => {
    let data = [...momList];

    if (selectedProject !== "ALL") {
      data = data.filter((m) => m.project === selectedProject);
    }

    return data;
  }, [momList, selectedProject]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredMom.length / itemsPerPage);

  const paginatedMom = filteredMom.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject]);

  // Edit Handler
  const handleEdit = (mom) => {
    setMomToEdit(mom);
    setIsModalOpen(true);
  };

  return (
    <MainLayout title="MOM Management">
      <div className="flex flex-col gap-4 p-3">
        {/* ✅ Toolbar */}
        <div className="flex flex-wrap justify-between gap-3 bg-bg-card border border-border-main rounded-xl p-3 shadow-sm">
          {/* ✅ View Toggle */}
          <div className="flex bg-bg-main rounded-lg p-1">
            {["list", "tiles"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  viewMode === mode
                    ? "bg-primary text-white shadow-md"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ✅ Project Dropdown Filter */}
          <div className="flex gap-2">
            <div>
              <label className="text-[10px] l-1 font-bold uppercase text-text-muted">
                Filter by Project
              </label>

              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm w-[300px]"
              >
                {projectOptions.map((proj, index) => (
                  <option key={index} value={proj}>
                    {proj}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ Add MOM Button */}
            <div>
              <button
                onClick={() => {
                  setMomToEdit(null);
                  setIsModalOpen(true);
                }}
                className="bg-primary text-white px-4 py-2 rounded-lg font-bold shadow-md"
              >
                + Create MOM
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Loading */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : paginatedMom.length === 0 ? (
          <div className="text-center p-12 text-text-muted font-bold">
            No MOM Found
          </div>
        ) : (
          <>
            {/* ✅ TABLE VIEW */}
            {viewMode === "list" && (
              <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-main/40 text-text-muted uppercase text-[10px]">
                      <th className="px-3 py-4">MOM ID</th>
                      <th className="px-5 py-4">Project Name</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Info Points</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedMom.map((mom) => (
                      <tr
                        key={mom?.id || "-"}
                        className="border-t border-border-main hover:bg-bg-main/20"
                      >
                        {/* MOM ID */}
                        <td className="px-5 py-4 font-bold">
                          {mom?.mom_id || "-"}
                        </td>

                        {/* Project */}
                        <td className="px-5 py-4 font-semibold">
                          {mom?.project || "-"}
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4 text-xs text-text-muted">
                          {new Date(mom?.date || "-").toLocaleDateString()}
                        </td>

                        {/* Info Points Count */}
                        <td className="px-5 py-4">
                          {mom?.minutes?.length > 0 ? (
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
                              {mom?.minutes.length || "-"} Points
                            </span>
                          ) : (
                            <span className="text-text-muted text-sm">
                              No Info Points
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex gap-3 justify-center items-center">
                            {/* View */}
                            <button
                              onClick={() => {
                                setViewMom(mom);
                                setIsViewModalOpen(true);
                              }}
                              className="flex items-center gap-1 text-primary font-bold hover:underline"
                            >
                              <Eye size={16} />
                              View
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEdit(mom)}
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

                {/* ✅ Pagination */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-border-main text-xs">
                  <p className="text-text-muted font-bold">
                    Showing {(currentPage - 1) * itemsPerPage + 1}–
                    {Math.min(currentPage * itemsPerPage, filteredMom.length)}{" "}
                    of {filteredMom.length}
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
                          className={`px-3 py-1 rounded-lg border font-bold ${
                            currentPage === page
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

            {/* ✅ TILE VIEW */}
            {viewMode === "tiles" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedMom.map((mom) => (
                  <MomCard key={mom.id} mom={mom} onEdit={handleEdit} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ✅ View Modal */}
        <ViewMomModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          mom={viewMom}
        />

        {/* ✅ Create/Edit Modal */}
        <CreateMomModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          momToEdit={momToEdit}
          onSuccess={() => dispatch(fetchMOM())}
        />
      </div>
    </MainLayout>
  );
};

export default Mom;
