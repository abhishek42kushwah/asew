import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import { createMOM, editMOM } from "../../store/slices/momSlice";
import { fetchEmployees, fetchProjects } from "../../store/slices/masterSlice";

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
/* Team Input Block */
/* ============================= */
const TeamInputBlock = ({ title, teamKey, formData, setFormData }) => {
  const values = formData[teamKey];

  // Add Member
  const addMember = () => {
    setFormData((prev) => ({
      ...prev,
      [teamKey]: [...prev[teamKey], ""],
    }));
  };

  // Remove Member
  const removeMember = (index) => {
    const updated = values.filter((_, i) => i !== index);

    setFormData((prev) => ({
      ...prev,
      [teamKey]: updated.length > 0 ? updated : [""],
    }));
  };

  // Change Member
  const handleChange = (index, value) => {
    const updated = [...values];
    updated[index] = value;

    setFormData((prev) => ({
      ...prev,
      [teamKey]: updated,
    }));
  };

  return (
    <div>
      <label className="text-[11px] font-bold uppercase text-text-muted">
        {title}
      </label>

      {values.map((val, index) => (
        <div key={index} className="flex gap-2 mt-2">
          <input
            value={val}
            placeholder={`${title} Member`}
            onChange={(e) => handleChange(index, e.target.value)}
            className="flex-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
          />

          {/* Remove Button */}
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => removeMember(index)}
              className="px-3 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20"
            >
              ✖
            </button>
          )}
        </div>
      ))}

      {/* Add Button */}
      <button
        type="button"
        onClick={addMember}
        className="text-primary text-sm mt-2 font-bold"
      >
        + Add Member
      </button>
    </div>
  );
};

/* ============================= */
/* MAIN COMPONENT */
/* ============================= */
const CreateMomModal = ({ isOpen, onClose, momToEdit, onSuccess }) => {
  const dispatch = useDispatch();

  const { isSubmitting } = useSelector((state) => state.mom);
  const { projects, employees } = useSelector((state) => state.master);

  /* Fetch Dropdown Data */
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchProjects());
      dispatch(fetchEmployees());
    }
  }, [dispatch, isOpen]);

  /* ============================= */
  /* Form State */
  /* ============================= */
  const [formData, setFormData] = useState({
    project: "",
    date: "",
    time: "",
    location: "",

    ra_team_attendees: [""],
    client_team_attendees: [""],
    vendor_team_attendees: [""],
    other_attendees: [""],

    minutes: [
      {
        sno: 1,
        minutes_discussed: "",
        action_by: "",
        planned_start: "",
        planned_completion: "",
        actual_completion: "",
        delayed_days: "",
        remarks: "",
      },
    ],
  });

  /* ============================= */
  /* ✅ Prefill Edit Mode */
  /* ============================= */
  useEffect(() => {
    if (momToEdit && isOpen) {
      setFormData({
        project: momToEdit.project || "",
        date: momToEdit.date || "",
        time: momToEdit.time || "",
        location: momToEdit.location || "",

        ra_team_attendees: momToEdit.ra_team_attendees?.length
          ? momToEdit.ra_team_attendees
          : [""],

        client_team_attendees: momToEdit.client_team_attendees?.length
          ? momToEdit.client_team_attendees
          : [""],

        vendor_team_attendees: momToEdit.vendor_team_attendees?.length
          ? momToEdit.vendor_team_attendees
          : [""],

        other_attendees: momToEdit.other_attendees?.length
          ? momToEdit.other_attendees
          : [""],

        minutes: momToEdit.minutes?.length
          ? momToEdit.minutes.map((m, i) => ({
              sno: i + 1,
              minutes_discussed: m.minutes_discussed || "",
              action_by: m.action_by || "",
              planned_start: m.planned_start || "",
              planned_completion: m.planned_completion || "",
              actual_completion: m.actual_completion || "",
              delayed_days: m.delayed_days || "",
              remarks: m.remarks || "",
            }))
          : [
              {
                sno: 1,
                minutes_discussed: "",
                action_by: "",
                planned_start: "",
                planned_completion: "",
                actual_completion: "",
                delayed_days: "",
                remarks: "",
              },
            ],
      });
    }
  }, [momToEdit, isOpen]);

  /* ============================= */
  /* ✅ Auto Calculate Delayed Days */
  /* ============================= */
  const calculateDelay = (planned, actual) => {
    if (!planned || !actual) return "";

    const plannedDate = new Date(planned);
    const actualDate = new Date(actual);

    const diffTime = actualDate - plannedDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  };

  /* ============================= */
  /* Minutes Handlers */
  /* ============================= */
  const addMinuteRow = () => {
    setFormData((prev) => ({
      ...prev,
      minutes: [
        ...prev.minutes,
        {
          sno: prev.minutes.length + 1,
          minutes_discussed: "",
          action_by: "",
          planned_start: "",
          planned_completion: "",
          actual_completion: "",
          delayed_days: "",
          remarks: "",
        },
      ],
    }));
  };

  const removeMinuteRow = (index) => {
    const updated = formData.minutes.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      minutes: updated.map((m, i) => ({ ...m, sno: i + 1 })),
    });
  };

  const handleMinuteChange = (index, field, value) => {
    const updated = [...formData.minutes];
    updated[index][field] = value;

    // ✅ Auto Delay Update
    if (field === "planned_completion" || field === "actual_completion") {
      updated[index].delayed_days = calculateDelay(
        updated[index].planned_completion,
        updated[index].actual_completion
      );
    }

    setFormData({ ...formData, minutes: updated });
  };

  /* ============================= */
  /* Submit */
  /* ============================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (momToEdit) {
        await dispatch(
          editMOM({
            id: momToEdit.id,
            updatedData: formData,
          })
        ).unwrap();

        toast.success("MOM Updated Successfully");
      } else {
        await dispatch(createMOM(formData)).unwrap();
        toast.success("MOM Created Successfully");
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
      <div className="bg-bg-card w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b border-border-main flex justify-between items-center bg-bg-main/20">
          <div>
            <h2 className="text-xl font-extrabold text-text-main">
              {momToEdit ? "Edit MOM" : "Create MOM"}
            </h2>
            <p className="text-[11px] uppercase tracking-widest text-text-muted font-bold mt-1">
              Minutes of Meeting Form
            </p>
          </div>

          <button
            onClick={onClose}
            className="size-10 rounded-full hover:bg-bg-main flex items-center justify-center text-text-muted text-lg"
          >
            ✖
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-10 max-h-[80vh] overflow-y-auto"
        >
          {/* Meeting Details */}
          <div className="bg-bg-main/30 p-6 rounded-2xl border border-border-main">
            <h3 className="font-bold text-primary mb-4 text-sm uppercase">
              Meeting Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="Project"
                value={formData.project}
                onChange={(e) =>
                  setFormData({ ...formData, project: e.target.value })
                }
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Meeting Date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />

              <Input
                label="Meeting Time"
                type="time"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
              />

              <Input
                label="Location / Link"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="bg-bg-main/30 p-6 rounded-2xl border border-border-main">
            <h3 className="font-bold text-primary mb-4 text-sm uppercase">
              Attendees
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="RA Team"
                value={formData.ra_team_attendees[0]}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ra_team_attendees: [e.target.value],
                  })
                }
              >
                <option value="">Select Member</option>
                {employees.map((emp) => (
                  <option
                    key={emp.id}
                    value={`${emp.First_Name} ${emp.Last_Name}`}
                  >
                    {emp.First_Name} {emp.Last_Name}
                  </option>
                ))}
              </Select>

              <TeamInputBlock
                title="Client Team"
                teamKey="client_team_attendees"
                formData={formData}
                setFormData={setFormData}
              />

              <TeamInputBlock
                title="Vendor Team"
                teamKey="vendor_team_attendees"
                formData={formData}
                setFormData={setFormData}
              />

              <TeamInputBlock
                title="Other Attendees"
                teamKey="other_attendees"
                formData={formData}
                setFormData={setFormData}
              />
            </div>
          </div>

          {/* Minutes */}
          <div className="bg-bg-main/30 p-6 rounded-2xl border border-border-main">
            <h3 className="font-bold text-primary mb-4 text-sm uppercase">
              Meeting Minutes
            </h3>

            <div className="overflow-auto rounded-xl border border-border-main">
              <table className="w-full text-sm">
                <thead className="bg-bg-main text-[11px] uppercase text-text-muted font-bold">
                  <tr>
                    <th className="p-3">S.No</th>
                    <th className="p-3">Minutes</th>
                    <th className="p-3">Action By</th>
                    <th className="p-3">Planned Completion</th>
                    <th className="p-3">Actual Completion</th>
                    <th className="p-3">Delayed Days</th>
                    <th className="p-3">Remarks</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {formData.minutes.map((row, index) => (
                    <tr key={index} className="border-t border-border-main">
                      <td className="p-3 text-center font-bold">{row.sno}</td>

                      <td className="p-2">
                        <textarea
                          value={row.minutes_discussed}
                          onChange={(e) =>
                            handleMinuteChange(
                              index,
                              "minutes_discussed",
                              e.target.value
                            )
                          }
                          className="w-full bg-bg-card border rounded-xl p-2 resize-none"
                        />
                      </td>

                      <td className="p-2">
                        <select
                          value={row.action_by}
                          onChange={(e) =>
                            handleMinuteChange(index, "action_by", e.target.value)
                          }
                          className="w-full bg-bg-card border rounded-xl px-2 py-2"
                        >
                          <option value="">Select</option>
                          {employees.map((emp) => (
                            <option key={emp.id}>
                              {emp.First_Name} {emp.Last_Name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="date"
                          value={row.planned_completion}
                          onChange={(e) =>
                            handleMinuteChange(
                              index,
                              "planned_completion",
                              e.target.value
                            )
                          }
                          className="w-full bg-bg-card border rounded-xl px-2 py-2"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="date"
                          value={row.actual_completion}
                          onChange={(e) =>
                            handleMinuteChange(
                              index,
                              "actual_completion",
                              e.target.value
                            )
                          }
                          className="w-full bg-bg-card border rounded-xl px-2 py-2"
                        />
                      </td>

                      {/* ✅ Auto Delay */}
                      <td className="p-2 text-center font-bold text-red-500">
                        {row.delayed_days || 0}
                      </td>

                      <td className="p-2">
                        <textarea
                          value={row.remarks}
                          onChange={(e) =>
                            handleMinuteChange(index, "remarks", e.target.value)
                          }
                          className="w-full bg-bg-card border rounded-xl p-2 resize-none"
                        />
                      </td>

                      <td className="p-2 text-center">
                        {formData.minutes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMinuteRow(index)}
                            className="text-red-500 font-bold text-lg"
                          >
                            ✖
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addMinuteRow}
              className="mt-4 px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20"
            >
              + Add Discussion Point
            </button>
          </div>

          {/* Footer */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-bg-main font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg"
            >
              {isSubmitting ? "Saving..." : "Save MOM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMomModal;
