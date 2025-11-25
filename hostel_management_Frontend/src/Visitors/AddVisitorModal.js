/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { API_URL } from "../API_URL";
import { masterConfig } from "../Masters/masterConfig";

const AddVisitorModal = ({ onSuccess }) => {
  const config = masterConfig.visitorvehicle;

  // ✅ Convert RFID field to text manually
  const modifiedConfig = config.map((field) =>
    field.bkname === "rfid_tag"
      ? { ...field, type: "text", default: "Enter RFID Tag" }
      : field
  );

  const [form, setForm] = useState({});
  const [dropdownData, setDropdownData] = useState({});

  // ✅ Fetch dropdown data (like location)
  useEffect(() => {
    const fetchDropdowns = async () => {
      const token = sessionStorage.getItem("accessToken");

      for (const field of modifiedConfig) {
        if (field.type === "dropdown" && field.apilink) {
          try {
            const res = await fetch(field.apilink, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.status && Array.isArray(data.data)) {
              setDropdownData((prev) => ({
                ...prev,
                [field.bkname]: data.data,
              }));
            }
          } catch (err) {
            console.error(`Failed to load ${field.bkname}:`, err);
          }
        }
      }
    };
    fetchDropdowns();
  }, []);

  // ✅ Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Form submission
  // ✅ Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem("accessToken");

    // ✅ Validate required fields
    const missing = modifiedConfig.filter(
      (f) => f.mandatory === "1" && !form[f.bkname]
    );
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.map((m) => m.dpname).join(", ")}`);
      return;
    }

    // ✅ Frontend Validations
    const mobileRegex = /^[0-9]{10}$/;
    const vehicleRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{3,4}$/i;

    if (form.rfid_tag && form.rfid_tag.trim().length !== 24) {
      toast.error("RFID Tag must be exactly 24 characters long");
      return;
    }

    if (form.mobile && !mobileRegex.test(form.mobile)) {
      toast.error("Mobile number must be 10 digits");
      return;
    }

    if (form.vehicleno && !vehicleRegex.test(form.vehicleno)) {
      toast.error("Please enter a valid vehicle number (e.g., TN01AB1234)");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/visitor/visitorvehicle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          created_by: sessionStorage.getItem("userId") || "system",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || "Failed to add visitor");
        return;
      }

      if (result.status) {
        toast.success("Visitor entry added successfully!");
        setForm({});
        document.getElementById("closeVisitorModal").click();
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.message || "Failed to add visitor");
      }
    } catch (err) {
      console.error("Error submitting visitor entry:", err);
      toast.error("Error submitting visitor entry");
    }
  };

  // ✅ Render dynamic form fields
  const renderField = (field) => {
    const value = form[field.bkname] || "";

    switch (field.type) {
      case "text":
        return (
          <input
            type="text"
            name={field.bkname}
            className="form-control form-control-sm"
            value={value}
            onChange={handleChange}
            placeholder={field.default}
            required={field.mandatory === "1"}
          />
        );

      case "dropdown":
        const options = dropdownData[field.bkname] || [];
        return (
          <select
            name={field.bkname}
            className="form-select form-select-sm"
            value={value}
            onChange={handleChange}
            required={field.mandatory === "1"}
          >
            <option value="">{field.default}</option>
            {options.map((opt) => (
              <option key={opt.id || opt.name} value={opt.id || opt.name}>
                {opt.name || opt.location_name || opt.status}
              </option>
            ))}
          </select>
        );

      case "datetime":
        return (
          <input
            type="datetime-local"
            name={field.bkname}
            className="form-control form-control-sm"
            value={value}
            onChange={handleChange}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="modal fade"
      id="addVisitorModal"
      tabIndex="-1"
      aria-labelledby="addVisitorModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static" // 🔒 Prevent closing when clicking outside
      data-bs-keyboard="false"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title" id="addVisitorModalLabel">
                Add Visitor Entry
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                id="closeVisitorModal"
              ></button>
            </div>

            <div className="modal-body">
              {modifiedConfig.map(
                (field) =>
                  field.view === "1" && (
                    <div key={field.bkname} className="mb-2">
                      <label className="form-label fw-semibold">
                        {field.dpname}{" "}
                        {field.mandatory === "1" && (
                          <span className="text-danger">*</span>
                        )}
                      </label>
                      {renderField(field)}
                    </div>
                  )
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-bs-dismiss="modal"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Save Entry
              </button>
            </div>
          </form>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default AddVisitorModal;
