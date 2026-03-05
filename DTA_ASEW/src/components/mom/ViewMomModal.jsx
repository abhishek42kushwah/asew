import React from "react";

const ViewMomModal = ({ isOpen, onClose, mom }) => {
  if (!isOpen || !mom) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              MOM Details
            </h2>
            <p className="text-[11px] uppercase text-text-muted font-bold tracking-widest">
              {mom.mom_id} • {mom.project}
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
            <Info label="Project Name" value={mom.project} />
            <Info label="Meeting Date" value={mom.date} />
            <Info label="Time" value={mom.time} />
            <Info label="Location" value={mom.location} />
          </div>

          {/* Attendees */}
          <div className="border border-border-main rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-primary text-sm mb-2">
              Attendees
            </h3>

            <Info
              label="RA Team"
              value={mom.ra_team_attendees?.join(", ") || "-"}
            />
            <Info
              label="Client Team"
              value={mom.client_team_attendees?.join(", ") || "-"}
            />
            <Info
              label="Vendor Team"
              value={mom.vendor_team_attendees?.join(", ") || "-"}
            />
            <Info
              label="Others"
              value={mom.other_attendees?.join(", ") || "-"}
            />
          </div>

          {/* Minutes Section */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-3">
              Minutes Discussed
            </h3>

            {mom.minutes?.length > 0 ? (
              <div className="space-y-3">
                {mom.minutes.map((item) => (
                  <div
                    key={item.sno}
                    className="p-3 rounded-xl border border-border-main bg-bg-main/20"
                  >
                    <p className="font-bold text-sm text-text-main">
                      {item.sno}. {item.minutes_discussed}
                    </p>

                    <p className="text-xs text-text-muted mt-1">
                      Action By:{" "}
                      <span className="font-semibold text-text-main">
                        {item.action_by}
                      </span>
                    </p>

                    <p className="text-xs text-text-muted">
                      Planned: {item.planned_start} →{" "}
                      {item.planned_completion}
                    </p>

                    {item.remarks && (
                      <p className="text-xs text-red-400 mt-1">
                        Remarks: {item.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">
                No Minutes Added
              </p>
            )}
          </div>

          {/* Created At */}
          <div className="border border-border-main rounded-xl p-4">
            <Info
              label="Created At"
              value={new Date(mom.created_at).toLocaleString()}
            />
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

export default ViewMomModal;
