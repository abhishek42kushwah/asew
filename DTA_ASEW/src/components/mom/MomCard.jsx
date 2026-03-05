import { useState } from "react";
import ViewMomModal from "../mom/ViewMomModal";

const MomCard = ({ mom, user, isAdmin, onEdit }) => {
  const [viewMom, setViewMom] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Format Date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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
              description
            </span>
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* MOM ID */}
            <span className="text-text-muted font-bold text-xs">
              {mom.mom_id}
            </span>

            {/* Project */}
            <h3 className="text-text-main font-bold text-base truncate mt-1">
              {mom.project}
            </h3>

            {/* Total Minutes Count */}
            <p className="text-sm font-bold text-primary mt-1">
              {mom.minutes?.length || 0} Info Points
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-1 bg-bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border-main shadow-sm">

          {/* View */}
          <button
            onClick={() => {
              setViewMom(mom);
              setIsViewModalOpen(true);
            }}
            className="p-1 text-text-muted hover:text-primary transition"
            title="View MOM"
          >
            <span className="material-symbols-outlined text-xl">
              visibility
            </span>
          </button>

          {/* Edit */}
          {(isAdmin || mom.created_by === user?.id) && (
            <button
              onClick={() => onEdit(mom)}
              className="p-1 text-text-muted hover:text-amber-500 transition"
              title="Edit MOM"
            >
              <span className="material-symbols-outlined text-xl">
                edit
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">

        {/* Location */}
        <InfoBlock
          icon="location_on"
          label="Location"
          value={mom.location || "N/A"}
          color="blue"
        />

        {/* Meeting Date */}
        <InfoBlock
          icon="event"
          label="Meeting Date"
          value={formatDate(mom.date)}
          color="purple"
        />
      </div>

      {/* Footer */}
      <div className="bg-bg-main/40 px-4 py-3 flex justify-between items-center border-t border-border-main text-xs">

        {/* Created At */}
        <div>
          <p className="text-[10px] uppercase font-bold text-text-muted">
            Created On
          </p>
          <p className="text-text-main font-semibold">
            {formatDate(mom.created_at)}
          </p>
        </div>
      </div>

      {/* View Modal */}
      <ViewMomModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        mom={viewMom}
      />
    </div>
  );
};

export default MomCard;

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
