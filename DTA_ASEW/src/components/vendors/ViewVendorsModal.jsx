import React from "react";

const ViewVendorsModal = ({ isOpen, onClose, vendor }) => {
  if (!isOpen || !vendor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              Vendor Details
            </h2>
            <p className="text-[11px] uppercase text-text-muted font-bold tracking-widest">
              {vendor.vendor_id} • {vendor.company_name}
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
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Company Name" value={vendor.company_name} />
            <Info label="Email" value={vendor.email} />
            <Info label="Location" value={vendor.location} />
            <Info label="Address" value={vendor.address} />
          </div>

          {/* Contact Info */}
          <div className="border border-border-main rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-primary text-sm mb-2">
              Contact Person
            </h3>

            <Info label="Name" value={vendor.contact_person} />
            <Info label="Phone" value={vendor.contact_number} />
          </div>

          {/* Profile Info */}
          <div className="border border-border-main rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-primary text-sm mb-2">
              Vendor Profile
            </h3>

            <Info label="Profile Name" value={vendor.profile_name} />
            <Info label="Suggested By" value={vendor.suggested_by} />
            <Info label="Document Type" value={vendor.profile_doc_type} />
          </div>

          {/* Categories */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Categories
            </h3>

            {vendor.categories?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vendor.categories.map((cat, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No Categories</p>
            )}
          </div>

          {/* Sub Categories */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Sub Categories
            </h3>

            {vendor.sub_categories?.length > 0 ? (
              <ul className="list-disc ml-5 space-y-1 text-sm text-text-main">
                {vendor.sub_categories.map((sub, i) => (
                  <li key={i}>{sub}</li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted text-sm">No Sub Categories</p>
            )}
          </div>

          {/* Projects */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Projects Assigned
            </h3>

            {vendor.projects?.length > 0 ? (
              <ol className="list-decimal ml-5 space-y-1 text-sm text-text-main">
                {vendor.projects.map((proj, i) => (
                  <li key={i}>{proj}</li>
                ))}
              </ol>
            ) : (
              <p className="text-text-muted text-sm">No Projects</p>
            )}
          </div>

          {/* Links */}
          <div className="border border-border-main rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-primary text-sm mb-2">
              Online Links
            </h3>

            <Info label="Website" value={vendor.website_url} />
            <Info label="LinkedIn" value={vendor.linkedin_url} />
          </div>

          {/* Document */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-2">
              Profile Document
            </h3>

            {vendor.profile_doc_value ? (
              <a
                href={vendor.profile_doc_value}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-bold hover:underline"
              >
                View Uploaded Document 📄
              </a>
            ) : (
              <p className="text-text-muted text-sm">
                No Document Uploaded
              </p>
            )}
          </div>

          {/* Created At */}
          <div className="border border-border-main rounded-xl p-4">
            <Info
              label="Created At"
              value={new Date(vendor.created_at).toLocaleString()}
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
    <p className="text-sm font-semibold text-text-main break-words">
      {value || "-"}
    </p>
  </div>
);

export default ViewVendorsModal;
