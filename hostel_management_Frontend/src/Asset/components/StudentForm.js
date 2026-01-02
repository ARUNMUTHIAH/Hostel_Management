/* eslint-disable eqeqeq */
/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { FormControl, Select, MenuItem, Typography } from "@mui/material";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import { API_URL } from "../../API_URL";
import errorHandlers from "../../utils/errorHandlers";
import { studentConfig } from "../studentConfig";
import { handleTokenExpired } from "../../utils/errorHandlers";
import { useEffect } from "react";

const StudentForm = ({
  assetManager,
  setAssetManager,
  fetchAssetData,
  handleCategorySelect,
  handleCloseModal,
}) => {
  const token = sessionStorage.getItem("accessToken");

  useEffect(() => {
    studentConfig.forEach(async (field) => {
      if (field.apilink) {
        try {
          const token = sessionStorage.getItem("accessToken");
          const res = await fetch(field.apilink, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();

          // defensive: ensure dropdown options is always an array
          const options = Array.isArray(data?.data) ? data?.data : [];

          setAssetManager((prev) => ({
            ...prev,
            dropdownOptions: {
              ...prev.dropdownOptions,
              [field.bkname]: options,
            },
          }));
        } catch (err) {
          console.error(`Failed to fetch options for ${field.bkname}`, err);
        }
      }
    });
  }, []);

  const handleValueChange = (id, level, newValue) => {
    setAssetManager((prev) => {
      const updated = [...prev.categoryTree];
      updated[level].value = updated[level].value?.map((item) =>
        item.id === id ? { ...item, value: newValue } : item
      );
      return { ...prev, categoryTree: updated };
    });
  };

  const handleChange = async (value, name, valueType) => {
    let parsedValue = value;

    // ✅ Only allow alphabets and spaces for student name
    if (name === "name") {
      const regex = /^[A-Za-z\s]*$/;
      if (!regex.test(value)) {
        // Optional: show a toast warning
        toast.error("Name can only contain alphabets and spaces", {
          autoClose: 1500,
        });
        return; // ignore invalid input
      }
    }

    if (name === "mobile") {
      parsedValue = value.replace(/\D/g, "").slice(0, 10);
    }
    if (name === "parentcontact") {
      parsedValue = value.replace(/\D/g, "").slice(0, 10);
    }

    if (valueType === "number") {
      if (value === "") {
        parsedValue = "";
      } else {
        const numericValue = Number(value);
        if ((name === "price" || name === "quantity") && numericValue < 0)
          return; //validation
        parsedValue = numericValue;
      }
    }

    setAssetManager((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        [name]: parsedValue,
      },
    }));

    if (name === "product_types") {
      handleCategorySelect(parsedValue, 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (assetManager.isSubmitting) return;
    setAssetManager((prev) => ({ ...prev, isSubmitting: true }));

    for (let i = 0; i < assetManager.categoryTree.length; i++) {
      const level = assetManager.categoryTree[i];
      const hasSelected = level.category?.some((c) => c.selected);
      if (level.category?.length > 0 && !hasSelected) {
        toast.error(`category${i + 1} is required.`, {
          autoClose: 2000,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          },
        });
        return;
      }
    }

    //  Validate all value fields: must not be empty
    for (let i = 0; i < assetManager.categoryTree.length; i++) {
      const level = assetManager.categoryTree[i];
      const invalidValue = level.value?.some((v) => !v.value?.trim());
      if (level.value?.length > 0 && invalidValue) {
        toast.error(`Please fill all values.`, {
          autoClose: 2000,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          },
        });
        return;
      }
    }

    // Mandatory field validation
    for (const config of studentConfig) {
      if (config.mandatory) {
        const fieldName = config.bkname;
        const fieldValue = assetManager.formData[fieldName];

        if (
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === "" ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        ) {
          toast.error(`${config.dpname} is required`, {
            autoClose: 2000,
            onClose: () => {
              setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
            },
          });
          return;
        }
      }

      // ⭐ CUSTOM VALIDATIONS BASED ON bkname
      const value = assetManager.formData[config.bkname];

      // 📌 MOBILE MUST BE 10 DIGITS
      if (config.bkname === "mobile" && value) {
        if (!/^[0-9]{10}$/.test(value)) {
          toast.error("Mobile number must be 10 digits", {
            autoClose: 1500,
          });
          setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }
      }

      // 📌 PARENT CONTACT MUST BE 10 DIGITS
      if (config.bkname === "parentcontact" && value) {
        if (!/^[0-9]{10}$/.test(value)) {
          toast.error("Parent contact must be 10 digits", {
            autoClose: 1500,
          });
          setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }
      }

      // 📌 EMAIL FORMAT VALIDATION
      if (config.bkname === "email" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          toast.error("Please enter a valid email address", {
            autoClose: 1500,
          });
          setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }
      }
      if (config.bkname === "parentemail" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          toast.error("Please enter a valid Parent email address", {
            autoClose: 1500,
          });
          setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }
      }
      // 📌 EXPIRY DATE MUST BE FUTURE OR TODAY
      if (config.bkname === "expirydate" && value) {
        const selectedDate = new Date(value);
        const today = new Date();

        selectedDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
          toast.error("Expiry date cannot be a past date", {
            autoClose: 1500,
          });
          setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }
      }
    }

    const {
      product_types,
      location,
      location1,
      location2,
      // status,
      ...restFormData
    } = assetManager.formData;

    const locations = [location, location1, location2]
      .filter(Boolean)
      .map((loc) => Number(loc));

    const payload = {
      ...restFormData,
      product_types: [],
      locations,
      // status: String(status),
    };

    const endpoint = assetManager.isEdit
      ? `${API_URL}/student/${assetManager.formData.id}`
      : `${API_URL}/student`;

    const method = assetManager.isEdit ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // 🚨 HTTP-level failure (400, 409, 500 etc)
      if (!response.ok) {
        toast.error(data?.message || "Submission failed. Please try again.", {
          autoClose: 2000,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          },
        });
        return;
      }

      // ✅ Success
      if (data.status) {
        toast.success(data.message, {
          autoClose: 1500,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
            handleCloseModal();
            setAssetManager((prev) => ({ ...prev, isEdit: false }));
            setAssetManager((prev) => ({ ...prev, formData: {} }));
            fetchAssetData();
            setAssetManager((prev) => ({ ...prev, categoryTree: [] }));
            window.location.reload();
          },
        });
      } else {
        if (data.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(data.message || "Submission failed!", {
          autoClose: 1500,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isSubmitting: false }));
          },
        });
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to submit form."
      );
      toast.error(errorMessage, { autoClose: 1000 });
    }
  };
  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;

    e.preventDefault();

    const modal = e.target.closest(".modal");
    if (!modal) return;

    const fields = Array.from(
      modal.querySelectorAll(
        "input:not([type='hidden']), textarea, button, .MuiSelect-select"
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    const index = fields.indexOf(e.target);
    setTimeout(() => fields[index + 1]?.focus(), 50);
  };

  return (
    <div
      className="modal fade"
      id="addUserModal"
      tabIndex="-1"
      aria-labelledby="addUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="true"
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div
            className="modal-header"
            style={{ borderBottom: "none", paddingBottom: "0" }}
          >
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={() => {
                setAssetManager((prev) => ({
                  ...prev,
                  formData: {},
                }));
                setAssetManager((prev) => ({
                  ...prev,
                  isEdit: false,
                }));
                setAssetManager((prev) => ({ ...prev, categoryTree: [] }));
              }}
            ></button>
          </div>
          <div className="modal-body pt-2">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="row g-2">
                {assetManager.categoryTree.map((category, level) => (
                  <>
                    {category.category.length > 0 && (
                      <div className="mb-2 col-4">
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            marginBottom: "4px",
                          }}
                        >
                          {" "}
                          Category ({level + 1})
                          <span style={{ color: "red" }}>*</span>:
                        </label>
                        <FormControl
                          fullWidth
                          size="small"
                          className="form-control"
                        >
                          <Select
                            displayEmpty
                            id={`category-select-${level}`}
                            value={
                              category.category.find((cat) => cat.selected)
                                ?.id || ""
                            }
                            onKeyDown={handleKeyDown}
                            onChange={(e) => {
                              const selectedId = parseInt(e.target.value);

                              setAssetManager((prev) => {
                                const updatedTree = [...prev.categoryTree];

                                if (updatedTree[level]) {
                                  updatedTree[level].category = updatedTree[
                                    level
                                  ].category.map((cat) => ({
                                    ...cat,
                                    selected: cat.id === selectedId,
                                  }));

                                  // Remove levels after the selected one
                                  updatedTree.splice(level + 1);
                                }

                                return {
                                  ...prev,
                                  categoryTree: updatedTree,
                                };
                              });

                              if (selectedId) {
                                handleCategorySelect(selectedId, level);
                              }
                            }}
                            sx={{
                              fontSize: "12px",
                              "& .MuiSelect-select": {
                                whiteSpace: "normal", //  allow height to grow
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                                display: "block",
                                padding: "6px 8px",
                                minHeight: "18px",
                              },
                            }}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 300,
                                },
                              },
                              disableAutoFocusItem: true,
                              getContentAnchorEl: null,
                            }}
                            onClose={() => {
                              setTimeout(() => {
                                const modal =
                                  document.querySelector("#addUserModal");
                                const fields = Array.from(
                                  modal.querySelectorAll(
                                    "input, textarea, button, .MuiSelect-select"
                                  )
                                ).filter(
                                  (el) =>
                                    !el.disabled && el.offsetParent !== null
                                );

                                const index = fields.findIndex(
                                  (f) => f === document.activeElement
                                );
                                const next = fields[index + 1];
                                if (next) next.focus();
                              }, 50);
                            }}
                          >
                            <MenuItem value="">
                              <em>Select Category</em>
                            </MenuItem>
                            {category.category.map((cat) => (
                              <MenuItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </div>
                    )}

                    {/* Value input */}
                    {category.value.length > 0 &&
                      category.value.map((val) => (
                        <div className="col-4" key={val.id}>
                          <label style={{ fontSize: "13px" }}>
                            {val.name} <span style={{ color: "red" }}>*</span> :
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm mt-1"
                            value={val.value}
                            onKeyDown={handleKeyDown}
                            onChange={(e) =>
                              handleValueChange(val.id, level, e.target.value)
                            }
                            placeholder={`Enter ${val.name}`}
                          />
                        </div>
                      ))}
                  </>
                ))}

                {studentConfig.map((value, index) => {
                  // eslint-disable-next-line no-unused-vars
                  const {
                    // eslint-disable-next-line no-unused-vars
                    key,
                    type,
                    dpname,
                    bkname,
                    mandatory,
                    valueType,
                    edit,
                  } = value;

                  const isDisabled = assetManager.isEdit && edit == "0";
                  const isQuantity = type === "quantity";
                  const isTextarea = type === "textarea";
                  const isFile = type === "file";

                  return (
                    <div className="col-4" key={index}>
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          marginBottom: "4px",
                        }}
                      >
                        {dpname}{" "}
                        {mandatory && <span style={{ color: "red" }}>*</span>}
                      </label>

                      {isQuantity ? (
                        <div className="d-flex align-items-center">
                          <input
                            type="number"
                            value={assetManager.formData[bkname] || ""}
                            min="0"
                            disabled={isDisabled}
                            className="form-control"
                            placeholder={dpname}
                            onKeyDown={handleKeyDown}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              height: "28px",
                              borderRadius: "4px",
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Reject negative values
                              if (val === "" || Number(val) >= 0) {
                                handleChange(val, bkname, valueType);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-light ms-1 px-2 py-0"
                            style={{ height: "28px", fontSize: "14px" }}
                            onClick={() => {
                              setAssetManager((prev) => ({
                                ...prev,
                                formData: {
                                  ...prev.formData,
                                  [bkname]:
                                    prev.formData[bkname] === "" ||
                                    prev.formData[bkname] === undefined
                                      ? 1
                                      : prev.formData[bkname] + 1,
                                },
                              }));
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn btn-light ms-1 px-2 py-0"
                            style={{ height: "28px", fontSize: "14px" }}
                            onClick={() => {
                              setAssetManager((prev) => ({
                                ...prev,
                                formData: {
                                  ...prev.formData,
                                  [bkname]:
                                    prev.formData[bkname] === "" ||
                                    prev.formData[bkname] === undefined
                                      ? 0
                                      : Math.max(0, prev.formData[bkname] - 1),
                                },
                              }));
                            }}
                          >
                            -
                          </button>
                        </div>
                      ) : isTextarea ? (
                        <textarea
                          className="form-control"
                          rows="1"
                          placeholder={dpname}
                          value={assetManager?.formData[bkname] || ""}
                          onChange={(e) =>
                            handleChange(e.target.value, bkname, valueType)
                          }
                          disabled={isDisabled}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "4px",
                          }}
                          onKeyDown={(e) => {
                            // ✅ ONLY FOR REMARKS FIELD
                            if (
                              bkname === "remarks" &&
                              (e.key === "Enter" || e.key === "Tab")
                            ) {
                              e.preventDefault(); // prevent new line or tabbing
                              handleSubmit(e); // 🔥 trigger submit
                              return;
                            }

                            // ✅ All other textareas behave normally
                            handleKeyDown(e);
                          }}
                        />
                      ) : isFile ? (
                        <input
                          type="file"
                          className="form-control"
                          style={{
                            padding: "2px 4px",
                            fontSize: "12px",
                            height: "28px",
                            borderRadius: "4px",
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      ) : type === "select" ? (
                        <FormControl
                          fullWidth
                          size="small"
                          className="form-control"
                        >
                          <Select
                            value={assetManager.formData[bkname] || ""}
                            // disabled={isDisabled}
                            displayEmpty
                            onChange={(e) =>
                              handleChange(e.target.value, bkname, valueType)
                            }
                            onKeyDown={handleKeyDown}
                            disabled={isDisabled}
                            sx={{
                              fontSize: "12px",
                              "& .MuiSelect-select": {
                                whiteSpace: "normal", //  allow height to grow
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                                display: "block",
                                padding: "6px 8px",
                                minHeight: "18px",
                              },
                            }}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 300,
                                },
                              },
                              disableAutoFocusItem: true,
                            }}
                          >
                            <MenuItem value="">
                              <em>Select {dpname}</em>
                            </MenuItem>
                            {assetManager.dropdownOptions?.[bkname]?.map(
                              (option) => (
                                <MenuItem key={option.id} value={option.id}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      whiteSpace: "normal",
                                      wordBreak: "break-word",
                                      fontSize: "12px",
                                    }}
                                  >
                                    {option.name}
                                  </Typography>
                                </MenuItem>
                              )
                            )}
                          </Select>
                        </FormControl>
                      ) : (
                        <input
                          type={bkname === "expirydate" ? "date" : type} // ✅ only expirydate uses date picker
                          className="form-control"
                          placeholder={dpname}
                          disabled={isDisabled}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            height: "28px",
                            borderRadius: "4px",
                          }}
                          value={assetManager.formData[bkname] || ""}
                          onChange={(e) => {
                            let val = e.target.value;

                            // Only for expirydate
                            if (bkname === "expirydate" && val) {
                              const parts = val.split("-"); // YYYY-MM-DD

                              // Force year to 4 digits
                              if (parts[0]?.length > 4) {
                                parts[0] = parts[0].slice(0, 4);
                                val = parts.join("-");
                              }
                            }

                            handleChange(val, bkname, valueType);
                          }}
                          onKeyDown={handleKeyDown}
                          min={
                            bkname === "expirydate"
                              ? new Date().toISOString().split("T")[0]
                              : undefined
                          } // ✅ only expirydate restriction
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-content-end mt-3">
                <button
                  className="btn me-2 px-4"
                  id="submitBtn"
                  type="button"
                  onClick={handleSubmit}
                  style={{
                    background: "linear-gradient(90deg, #005F9E, #1E90FF)",
                    color: "white",
                    fontSize: "14px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                  }}
                  disabled={assetManager.isSubmitting}
                >
                  {assetManager.isEdit ? "Update" : "Submit"}
                  {assetManager.isSubmitting && (
                    <span
                      className="spinner-border spinner-border-sm ms-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  )}
                </button>

                <button
                  type="button"
                  className="btn px-4"
                  data-bs-dismiss="modal"
                  style={{
                    backgroundColor: "#FF2D2D",
                    color: "white",
                    fontSize: "14px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                  }}
                  onClick={() => {
                    setAssetManager((prev) => ({ ...prev, formData: {} }));
                    setAssetManager((prev) => ({ ...prev, isEdit: false }));
                    setAssetManager((prev) => ({ ...prev, categoryTree: [] }));
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentForm;
