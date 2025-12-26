/* eslint-disable eqeqeq */
import React, { useRef } from "react";
import errorHandlers from "../../utils/errorHandlers";
import Select from "react-select";
import { toast } from "react-toastify";
import { API_URL } from "../../API_URL"; // update the path as needed
import "./MasterFormModal.css";

const MasterFormModal = ({
  configMasters,
  masterChanges,
  setMasterChanges,
  onInputChange,
  masterKey,
  fetchData,
  fieldOptions,
  handleTokenExpired,
}) => {
  const inputRefs = useRef([]);
  const submitBtnRef = useRef(null);
  const token = sessionStorage.getItem("accessToken");

  // ✅ Detect if selected role is SuperAdmin (any case, with or without spaces/underscores)

  const validateForm = () => {
    // ✅ Detect if selected role is SuperAdmin
    const selectedRoleId = masterChanges.added?.role_id;
    const roles = fieldOptions["role_id"] || [];
    const selectedRole = roles.find((r) => r.id == selectedRoleId);
    const isSuperAdmin = selectedRole
      ? selectedRole.name.replace(/[\s_]/g, "").toLowerCase() === "superadmin"
      : false;

    const errorMessages = configMasters
      .map(({ bkname, dpname, mandatory, type }) => {
        const value = masterChanges.added?.[bkname];

        // ✅ Skip Centers validation if SuperAdmin
        if (isSuperAdmin && bkname === "hostel_id") {
          return null;
        }

        // 1️⃣ Required field validation
        const isEmpty =
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "") ||
          (Array.isArray(value) && value.length === 0);

        if (mandatory === "1" && isEmpty && value !== 0) {
          return `${dpname} is required`;
        }

        // 2️⃣ Email format validation
        if (
          type === "text" &&
          bkname?.toLowerCase()?.includes("email") &&
          value
        ) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return `Invalid email format`;
          }
        }

        return null; // no error
      })
      .filter(Boolean); // remove nulls

    return errorMessages.length ? errorMessages[0] : null;
  };

  const handleSubmit = async () => {
    if (masterChanges.isSubmitting) return;

    setMasterChanges((prev) => ({ ...prev, isSubmitting: true }));

    const validationError = validateForm();

    if (validationError) {
      toast.error(validationError, {
        autoClose: 2000,
        onClose: () =>
          setMasterChanges((prev) => ({ ...prev, isSubmitting: false })),
      });
      return;
    }

    const isEdit = masterChanges.mode === "edit";
    const current = masterChanges.added;
    const original = masterChanges.originalData || {};
    const payload = isEdit
      ? Object.fromEntries(
          Object.entries(current).filter(
            ([key, value]) => value !== original[key]
          )
        )
      : current;

    if (isEdit && Object.keys(payload).length === 0) {
      toast.info("No changes to update", {
        autoClose: 2000,
        onClose: () =>
          setMasterChanges((prev) => ({ ...prev, isSubmitting: false })),
      });

      return;
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit
      ? `${API_URL}/${masterKey}/${original.id}`
      : `${API_URL}/${masterKey}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.status) {
        toast.success(
          result.message || (isEdit ? "Updated" : "Added") + " successfully",
          {
            autoClose: 2000,
            onClose: () => {
              document.getElementById("closeModal")?.click();
              fetchData();
              setMasterChanges({
                mode: "add",
                added: {},
                edit: {},
                originalData: {},
                delete: {
                  show: false,
                  ids: [],
                  loading: false,
                },
                isSubmitting: false,
                selectAll: false,
              });
            },
          }
        );
      } else {
        if (result.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(
          result.message || (isEdit ? "Update failed" : "Add failed"),
          {
            autoClose: 2000,
            onClose: () => {
              setMasterChanges((prev) => ({ ...prev, isSubmitting: false }));
            },
          }
        );
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch master data."
      );
      toast.error(errorMessage, { autoClose: 2000 });

      setMasterChanges((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div
      className="modal fade"
      id="addUserModal"
      tabIndex="-1"
      aria-labelledby="addUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div className="modal-dialog modal-dialog-centered modal-md">
        <div className="modal-content" style={{ borderRadius: "10px" }}>
          <div className="modal-header pb-0" style={{ borderBottom: "none" }}>
            <button
              id="closeModal"
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={() => {
                setMasterChanges({
                  mode: "add",
                  added: {},
                  edit: {},
                  originalData: {},
                  delete: {
                    show: false,
                    ids: [],
                    loading: false,
                  },
                  isSubmitting: false,
                  selectAll: false,
                });
              }}
            ></button>
          </div>

          <div className="modal-body pt-2 pb-1">
            <form>
              <div className="row g-2">
                {configMasters?.map(
                  (
                    {
                      dpname,
                      bkname,
                      type,
                      options,
                      default: placeholder,
                      mandatory,
                      isSensitive,
                      showInFilter = true,
                    },
                    index
                  ) => {
                    if (!showInFilter) return null;

                    const isHostelField = bkname === "hostel_id";
                    const selectedRoleId = masterChanges.added["role_id"];
                    const roles = fieldOptions["role_id"] || [];
                    const selectedRole = roles.find(
                      (r) => r.id == selectedRoleId
                    );

                    const selectedRoleName = selectedRole?.name
                      ?.replace(/[\s_]/g, "")
                      .toLowerCase();

                    const isSuperAdmin = selectedRoleName === "superadmin";
                    const isAdmin = selectedRoleName === "admin";

                    const isHostelDisabled = isHostelField && isSuperAdmin;
                    const isHostelMultiSelect = isHostelField && isAdmin; // Admin → multiselect
                    const isHostelSingleSelect =
                      isHostelField && !isSuperAdmin && !isAdmin; // Others → single select

                    return (
                      <div className="col-6" key={index}>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            marginBottom: "4px",
                          }}
                        >
                          {dpname}{" "}
                          {mandatory == "1" && (
                            <span style={{ color: "red" }}>*</span>
                          )}
                        </label>

                        {/* === SINGLE DROPDOWN === */}
                        {type === "dropdown" ? (
                          <select
                            ref={(el) => (inputRefs.current[index] = el)}
                            className="form-select bg-white"
                            id={bkname}
                            value={masterChanges.added[bkname] ?? ""}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              height: "28px",
                              borderRadius: "4px",
                            }}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              onInputChange(bkname, selectedValue);

                              // ✅ If SuperAdmin role selected, clear centers
                              const roles = fieldOptions["role_id"] || [];
                              const selectedRole = roles.find(
                                (r) => r.id == selectedValue
                              );
                              if (
                                selectedRole?.name
                                  ?.replace(/[\s_]/g, "")
                                  .toLowerCase() === "superadmin"
                              ) {
                                onInputChange("hostel_id", []);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const nextField = inputRefs.current[index + 1];
                                if (nextField) nextField.focus();
                                else {
                                  submitBtnRef.current?.focus();
                                  handleSubmit();
                                }
                              }
                            }}
                          >
                            <option value="">Select {dpname}</option>
                            {fieldOptions[bkname]?.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        ) : type === "multiselect" ? (
                          <>
                            {/* === LOCATION FIELD SPECIAL LOGIC === */}
                            {isHostelField ? (
                              <>
                                {!isHostelDisabled && (
                                  <div className="d-flex justify-content-end mb-1">
                                    {/* Show Select All / Deselect All button only when centers are enabled AND multi-select */}
                                    {!isHostelDisabled &&
                                      isHostelMultiSelect && (
                                        <div className="d-flex justify-content-end mb-1">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            style={{
                                              fontSize: "11px",
                                              padding: "2px 6px",
                                            }}
                                            onClick={() => {
                                              const allOptions =
                                                fieldOptions[bkname]?.map(
                                                  (opt) => opt.id
                                                ) || [];
                                              const selected =
                                                masterChanges.added[bkname] ||
                                                [];
                                              const isAllSelected =
                                                selected.length ===
                                                allOptions.length;
                                              const newValues = isAllSelected
                                                ? []
                                                : allOptions;
                                              setMasterChanges((prev) => ({
                                                ...prev,
                                                added: {
                                                  ...prev.added,
                                                  [bkname]: newValues,
                                                },
                                                selectAll: !isAllSelected,
                                              }));
                                            }}
                                          >
                                            {Array.isArray(
                                              masterChanges.added[bkname]
                                            ) &&
                                            masterChanges.added[bkname]
                                              .length ===
                                              (fieldOptions[bkname]?.length ||
                                                0)
                                              ? "Deselect All"
                                              : "Select All"}
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                )}

                                {/* === SELECT COMPONENT (SINGLE/MULTI BASED ON ROLE) === */}
                                <Select
                                  ref={(el) => (inputRefs.current[index] = el)}
                                  tabIndex={0}
                                  isDisabled={isHostelDisabled}
                                  placeholder={
                                    isHostelDisabled
                                      ? "All Institute are accessible"
                                      : isHostelSingleSelect
                                      ? "Select one Institute"
                                      : "Select Institute"
                                  }
                                  onKeyDown={(e) => {
                                    const isDropdownOpen =
                                      document.querySelector(
                                        ".react-select__menu"
                                      ) !== null;
                                    if (e.key === "Enter") {
                                      if (isDropdownOpen) {
                                        e.stopPropagation();
                                        return;
                                      }
                                      e.preventDefault();
                                      const nextField =
                                        inputRefs.current[index + 1];
                                      if (nextField) nextField.focus();
                                      else {
                                        submitBtnRef.current?.focus();
                                        handleSubmit();
                                      }
                                    }
                                  }}
                                  isMulti={isHostelMultiSelect}
                                  id={bkname}
                                  classNamePrefix="react-select"
                                  className="basic-multi-select custom-multiselect"
                                  menuPlacement="auto"
                                  maxMenuHeight={120}
                                  required={mandatory === "1"}
                                  value={
                                    Array.isArray(masterChanges.added[bkname])
                                      ? masterChanges.added[bkname]
                                          .map((val) => {
                                            const match = fieldOptions[
                                              bkname
                                            ]?.find((opt) => opt.id === val);
                                            return match
                                              ? {
                                                  value: match.id,
                                                  label: match.name,
                                                }
                                              : null;
                                          })
                                          .filter(Boolean)
                                      : []
                                  }
                                  onChange={(selectedOptions) => {
                                    if (isHostelDisabled) return; // Prevent editing centers if SuperAdmin

                                    // Convert value based on select mode
                                    let values = [];
                                    if (isHostelSingleSelect) {
                                      values = selectedOptions
                                        ? [selectedOptions.value]
                                        : [];
                                    } else {
                                      values =
                                        selectedOptions?.map(
                                          (opt) => opt.value
                                        ) || [];
                                    }

                                    onInputChange(bkname, values);
                                  }}
                                  options={
                                    fieldOptions[bkname]?.map((opt) => ({
                                      value: opt.id,
                                      label: opt.name,
                                    })) || []
                                  }
                                />
                              </>
                            ) : (
                              // === NORMAL MULTISELECT (unchanged for non-location fields) ===
                              <>
                                <div className="d-flex justify-content-end mb-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    style={{
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                    }}
                                    onClick={() => {
                                      const allOptions =
                                        fieldOptions[bkname]?.map(
                                          (opt) => opt.id
                                        ) || [];
                                      const selected =
                                        masterChanges.added[bkname] || [];
                                      const isAllSelected =
                                        selected.length === allOptions.length;
                                      const newValues = isAllSelected
                                        ? []
                                        : allOptions;
                                      setMasterChanges((prev) => ({
                                        ...prev,
                                        added: {
                                          ...prev.added,
                                          [bkname]: newValues,
                                        },
                                        selectAll: !isAllSelected,
                                      }));
                                    }}
                                  >
                                    {Array.isArray(
                                      masterChanges.added[bkname]
                                    ) &&
                                    masterChanges.added[bkname].length ===
                                      (fieldOptions[bkname]?.length || 0)
                                      ? "Deselect All"
                                      : "Select All"}
                                  </button>
                                </div>

                                <Select
                                  ref={(el) => (inputRefs.current[index] = el)}
                                  tabIndex={0}
                                  placeholder="Select options"
                                  isMulti
                                  id={bkname}
                                  classNamePrefix="react-select"
                                  className="basic-multi-select custom-multiselect"
                                  menuPlacement="auto"
                                  maxMenuHeight={120}
                                  required={mandatory === "1"}
                                  value={
                                    Array.isArray(masterChanges.added[bkname])
                                      ? masterChanges.added[bkname]
                                          .map((val) => {
                                            const match = fieldOptions[
                                              bkname
                                            ]?.find((opt) => opt.id === val);
                                            return match
                                              ? {
                                                  value: match.id,
                                                  label: match.name,
                                                }
                                              : null;
                                          })
                                          .filter(Boolean)
                                      : []
                                  }
                                  onChange={(selectedOptions) => {
                                    const values =
                                      selectedOptions?.map(
                                        (opt) => opt.value
                                      ) || [];
                                    onInputChange(bkname, values);
                                  }}
                                  options={
                                    fieldOptions[bkname]?.map((opt) => ({
                                      value: opt.id,
                                      label: opt.name,
                                    })) || []
                                  }
                                />
                              </>
                            )}
                          </>
                        ) : type === "multiselect-checkbox" ? (
                          <div className="permission-wrapper">
                            <div className="permission-header d-flex justify-content-end align-items-center mb-2">
                              <button
                                type="button"
                                className="select-btn"
                                onClick={() => {
                                  const allIds =
                                    fieldOptions[bkname]?.map(
                                      (opt) => opt.id
                                    ) || [];
                                  const selected =
                                    masterChanges.added[bkname] || [];
                                  const isAllSelected =
                                    selected.length === allIds.length;
                                  const newValues = isAllSelected ? [] : allIds;
                                  setMasterChanges((prev) => ({
                                    ...prev,
                                    added: {
                                      ...prev.added,
                                      [bkname]: newValues,
                                    },
                                    selectAll: !isAllSelected,
                                  }));
                                }}
                              >
                                {(masterChanges.added[bkname]?.length || 0) ===
                                (fieldOptions[bkname]?.length || 0)
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            </div>

                            <div className="permission-flex">
                              {fieldOptions[bkname]?.map((opt) => {
                                const checked = (
                                  masterChanges.added[bkname] || []
                                ).includes(opt.id);
                                return (
                                  <label
                                    key={opt.id}
                                    className={`perm-tile ${
                                      checked ? "active" : ""
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const prev =
                                          masterChanges.added[bkname] || [];
                                        const newVal = e.target.checked
                                          ? [...prev, opt.id]
                                          : prev.filter((id) => id !== opt.id);
                                        onInputChange(bkname, newVal);
                                      }}
                                    />
                                    <span>{opt.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : type === "select" ? (
                          <select
                            ref={(el) => (inputRefs.current[index] = el)}
                            className="form-select bg-white"
                            id={bkname}
                            value={masterChanges.added[bkname] ?? ""}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              height: "28px",
                              borderRadius: "4px",
                            }}
                            onChange={(e) =>
                              onInputChange(bkname, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const nextField = inputRefs.current[index + 1];
                                if (nextField) nextField.focus();
                                else {
                                  submitBtnRef.current?.focus();
                                  handleSubmit();
                                }
                              }
                            }}
                          >
                            <option value="">Select {dpname}</option>
                            {options?.map((opt, idx) => (
                              <option key={idx} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : type === "time" ? (
                          <input
                            type="time"
                            className="form-control"
                            value={masterChanges.added[bkname] || ""}
                            onChange={(e) =>
                              setMasterChanges({
                                ...masterChanges,
                                added: {
                                  ...masterChanges.added,
                                  [bkname]: e.target.value,
                                },
                              })
                            }
                            required={mandatory === "1"}
                          />
                        ) : /* === CHECKBOX FIELD === */
                        type === "checkbox" ? (
                          <div
                            className="form-check"
                            style={{ marginTop: "8px" }}
                          >
                            <input
                              ref={(el) => (inputRefs.current[index] = el)}
                              className="form-check-input"
                              type="checkbox"
                              id={bkname}
                              checked={
                                masterChanges.added[bkname] == 1 ||
                                masterChanges.added[bkname] === true
                              }
                              onChange={(e) =>
                                onInputChange(bkname, e.target.checked ? 1 : 0)
                              }
                              style={{ cursor: "pointer" }}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={bkname}
                              style={{
                                fontSize: "12px",
                                fontWeight: "500",
                                cursor: "pointer",
                              }}
                            >
                              {dpname}
                            </label>
                          </div>
                        ) : isSensitive && masterChanges.mode === "edit" ? (
                          <div className="input-group">
                            {!masterChanges.showPasswordInput ? (
                              <>
                                <input
                                  type="text"
                                  className="form-control"
                                  value="••••••"
                                  readOnly
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    height: "28px",
                                    borderRadius: "4px",
                                    backgroundColor: "#f5f5f5",
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  style={{ height: "28px" }}
                                  onClick={() => {
                                    setMasterChanges((prev) => ({
                                      ...prev,
                                      added: {
                                        ...prev.added,
                                        [bkname]: "",
                                      },
                                      showPasswordInput: true,
                                    }));
                                  }}
                                >
                                  Edit
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="password"
                                  className="form-control"
                                  placeholder="Enter new password"
                                  value={masterChanges.added[bkname] || ""}
                                  onChange={(e) =>
                                    onInputChange(bkname, e.target.value)
                                  }
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    height: "28px",
                                    borderRadius: "4px",
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  style={{ height: "28px" }}
                                  onClick={() => {
                                    onInputChange(
                                      bkname,
                                      masterChanges.originalData?.[bkname]
                                    );
                                    setMasterChanges((prev) => ({
                                      ...prev,
                                      showPasswordInput: false,
                                    }));
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <input
                            ref={(el) => (inputRefs.current[index] = el)}
                            type="text" // use text to block e,+,-
                            className="form-control"
                            placeholder={dpname}
                            value={masterChanges.added[bkname] || ""}
                            maxLength={
                              bkname === "mobileno" ||
                              bkname === "warden_contact"
                                ? 10
                                : undefined
                            }
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              height: "28px",
                              borderRadius: "4px",
                            }}
                            onChange={(e) => {
                              let val = e.target.value;

                              // Allow only digits for both fields
                              if (
                                bkname === "mobileno" ||
                                bkname === "warden_contact"
                              ) {
                                val = val.replace(/\D/g, ""); // remove non-numeric
                                if (val.length > 10) return; // block extra digits
                              }

                              onInputChange(bkname, val);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const nextField = inputRefs.current[index + 1];
                                if (nextField) nextField.focus();
                                else {
                                  submitBtnRef.current?.focus();
                                  handleSubmit();
                                }
                              }
                            }}
                          />
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </form>
          </div>

          <div
            className="modal-footer pt-2 justify-content-end"
            style={{ borderTop: "none" }}
          >
            <button
              ref={submitBtnRef}
              type="button"
              className="btn btn-primary"
              style={{
                background: "linear-gradient(90deg, #005F9E, #1E90FF)",
                border: "none",
                fontSize: "13px",
                padding: "6px 16px",
                borderRadius: "4px",
                color: "#fff", // ensure text is readable
              }}
              onClick={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // handleSubmit();

                  // 👇 Automatically focus first input field after submit
                  setTimeout(() => {
                    inputRefs.current[0]?.focus();
                  }, 0);
                }
              }}
            >
              {masterChanges.mode === "edit" ? "Update" : "Add"}{" "}
              {masterChanges.isSubmitting && (
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterFormModal;
