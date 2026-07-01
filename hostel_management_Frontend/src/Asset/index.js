/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import errorHandlers, { handleTokenExpired } from "../utils/errorHandlers";
import SidebarDashboard from "../Sidebar/sidebar";
import { useEffect, useState } from "react";
import { API_URL } from "../API_URL";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Modal } from "bootstrap";
import { FaPlay } from "react-icons/fa";

import AssetTable from "./components/StudentTable";
import DeleteModal from "./components/DeleteModal";
import HeaderSection from "./components/HeaderSection";
import StudentForm from "./components/StudentForm";

const StudentRegistration = () => {
  const token = sessionStorage.getItem("accessToken");
  const [assetManager, setAssetManager] = useState({
    formData: {},
    assetData: [],
    selectedRowIds: [],
    categoryTree: [],
    dropdownOptions: {
      status: [
        { id: "1", name: "Active" },
        { id: "0", name: "Inactive" },
      ],
    },
    isEdit: false,
    loading: false,
    searchTerm: "",
    bulkFile: null,
    isSubmitting: false,
    deleteModal: { show: false, id: null },
    isDeleting: false,
    toastActive: false,
    pagination: {
      page: 1,
      pageSize: 10,
      totalPages: 0,
      totalCount: 0,
    },
  });
  console.log("assetManager", assetManager);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setAssetManager((prev) => ({
        ...prev,
        selectedRowIds: [],
        pagination: {
          ...prev.pagination,
          page: 1,
        },
      }));

      fetchAssetData(1);
    }, 1000);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetManager.searchTerm]);

  useEffect(() => {
    fetchAssetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only Excel files (.xls or .xlsx) are allowed.");
      e.target.value = null; // Reset the input
      return;
    }

    setAssetManager((prev) => ({ ...prev, bulkFile: file }));
  };

  const handleBulkUpload = async () => {
    if (!assetManager.bulkFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setAssetManager((prev) => ({ ...prev, isSubmitting: true }));

    const formDataData = new FormData();
    formDataData.append("uploadfile", assetManager.bulkFile);

    try {
      const response = await fetch(`${API_URL}/student/bulk_student_upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataData,
      });

      const contentType = response.headers.get("content-type") || "";

      const fileInput = document.getElementById("formFile");

      if (contentType.includes("application/json")) {
        const data = await response.json();

        if (data.status) {
          toast.success(data.message || "Upload successful");
          setAssetManager((prev) => ({
            ...prev,
            bulkFile: null,
            pagination: { ...prev.pagination, page: 1 },
          }));
          handleCloseBulkUploadModal();
          fetchAssetData(1);
        } else {
          if (data.message === "Token expired") {
            handleTokenExpired();
            return;
          }
          toast.error(data.message || "Upload failed");
          setAssetManager((prev) => ({ ...prev, bulkFile: null }));
          if (fileInput) fileInput.value = null;
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Upload_Errors.xlsx";
        a.click();

        toast.error("Upload failed. Error file downloaded.", {
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, bulkFile: null }));
            if (fileInput) fileInput.value = null;
          },
        });
      }
    } catch (error) {
      const msg = errorHandlers.handleCommonApiError(
        error,
        "Upload failed. Try again."
      );
      toast.error(msg);
      setAssetManager((prev) => ({ ...prev, bulkFile: null }));
      const fileInput = document.getElementById("formFile");
      if (fileInput) fileInput.value = null;
    } finally {
      setAssetManager((prev) => ({
        ...prev,
        isSubmitting: false,
        pagination: { ...prev.pagination, page: 1 },
      }));
      fetchAssetData(1);
    }
  };

  const handleEdit = async (id) => {
    setAssetManager((prev) => ({ ...prev, isEdit: true }));
    console.log(
      "handleEdit called for id:",
      id,
      "URL:",
      `${API_URL}/student?id=${id}`
    );

    try {
      console.log("Fetching student data...");

      const response = await fetch(`${API_URL}/student?id=${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Fetch response:", response);

      const data = await response.json();
      console.log("Parsed JSON data:", data);

      if (!data.status) {
        if (data.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(data.message || "Failed to fetch record!", {
          autoClose: 1500,
          onClose: () => {
            handleCloseModal();
            setAssetManager((prev) => ({ ...prev, isEdit: false }));
          },
        });
        return;
      }

      if (!data.data || !data.data.length) {
        console.warn("No student data found for id:", id);
        return;
      }

      // Pick the first student from the array
      const student = data.data[0];

      // Handle product types tree safely
      const productTypesTree = student.product_types || [];
      const pathIds = [];
      const valueFields = [];

      const traverse = (node) => {
        if (!node) return;
        if (String(node.type).toLowerCase() === "v") {
          valueFields.push({
            id: node.id,
            name: node.name,
            value: node.value,
          });
        } else {
          pathIds.push(node.id); // category
        }
        if (node.children && node.children.length) {
          node.children.forEach(traverse);
        }
      };

      if (productTypesTree.length) traverse(productTypesTree[0]);

      const mainType = pathIds[0] || "";

      // Set base formData
      setAssetManager((prev) => ({
        ...prev,
        formData: {
          ...student,
          product_types: String(mainType),
          status: String(student.status),
          location: student?.locations?.[0]?.id || "",
          location1: student?.locations?.[1]?.id || "",
          location2: student?.locations?.[2]?.id || "",
        },
      }));

      setAssetManager((prev) => ({ ...prev, categoryTree: [] }));

      // Chain selection for categories
      for (let i = 0; i < pathIds.length; i++) {
        console.log(
          "Selecting category node:",
          i,
          "parentId:",
          pathIds[i],
          "selectedId:",
          pathIds[i + 1]
        );
        await handleCategorySelect(pathIds[i], i, pathIds[i + 1], true);
      }

      // Set values in the final level
      if (valueFields.length) {
        setAssetManager((prev) => {
          const updatedTree = prev.categoryTree.map((entry) => {
            const updatedValues = entry.value.map((v) => {
              const matched = valueFields.find((val) => val.id === v.id);
              return matched ? { ...v, value: matched.value } : v;
            });
            return { ...entry, value: updatedValues };
          });

          return { ...prev, categoryTree: updatedTree };
        });
      }

      console.log("Category pathIds:", pathIds, "Value fields:", valueFields);

      // Populate dropdowns if needed
      fetchDropDownValue();

      // Show modal
      const modalElement = document.getElementById("addUserModal");
      const modalInstance = Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    } catch (error) {
      console.error("Error in handleEdit:", error);
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch record."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    }
  };

  const fetchAssetData = async (
    page = assetManager.pagination.page,
    pageSize = assetManager.pagination.pageSize
  ) => {
    setAssetManager((prev) => ({ ...prev, loading: true }));

    try {
      // 🔑 Build URL conditionally
      const queryParams = new URLSearchParams();

      if (assetManager.searchTerm) {
        queryParams.append("search", assetManager.searchTerm);
      } else {
        queryParams.append("page", page);
        queryParams.append("pagesize", pageSize);
      }

      const response = await fetch(
        `${API_URL}/student?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data?.message === "Token expired") {
        handleTokenExpired();
        return;
      }

      const safeData = Array.isArray(data?.data) ? data.data : [];

      const updatedData = safeData.map((item) => ({
        ...item,
        selected: assetManager.selectedRowIds.includes(item.id),
      }));

      setAssetManager((prev) => ({
        ...prev,
        assetData: updatedData,
        loading: false,
        pagination: {
          ...prev.pagination,
          page: assetManager.searchTerm ? 1 : page,
          pageSize: assetManager.searchTerm ? safeData.length : pageSize,
          totalCount: data?.count || safeData.length,
          totalPages: assetManager.searchTerm
            ? 1
            : Math.max(1, Math.ceil((data?.count || 0) / pageSize)),
        },
      }));
    } catch (error) {
      const msg = errorHandlers.handleCommonApiError(
        error,
        "Error fetching student data. Try again."
      );

      toast.error(msg);

      setAssetManager((prev) => ({
        ...prev,
        assetData: [],
        loading: false,
        pagination: {
          ...prev.pagination,
          totalCount: 0,
          totalPages: 1,
        },
      }));
    }
  };

  const fetchDropDownValue = async () => {
    try {
      const response = await fetch(`${API_URL}/dropdown/get_all_dropdowns`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      setAssetManager((prev) => ({
        ...prev,
        dropdownOptions: {
          ...prev.dropdownOptions,
          ...data.data,
          status: prev.dropdownOptions.status,
        },
      }));
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    }
  };

  const handleCategorySelect = async (
    id,
    level,
    forceSelectedId = null,
    isEdit = false
  ) => {
    if (!id) return;

    try {
      const response = await fetch(`${API_URL}/dropdown/product_type`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent_id: id }),
      });
      const result = await response.json();
      // const result = nextCategoryResponse[id] || [];
      if (result.status) {
        const categoryItems = result.data.filter(
          (item) => item.type.toUpperCase() === "C"
        );
        const valueItems = result.data.filter(
          (item) => item.type.toUpperCase() === "V"
        );

        if (categoryItems.length > 0 || valueItems.length > 0) {
          setAssetManager((prev) => ({
            ...prev,
            categoryTree: [
              ...prev.categoryTree,
              {
                category: categoryItems.map((item) => ({
                  ...item,
                  selected: forceSelectedId
                    ? item.id === forceSelectedId
                    : categoryItems.length === 1,
                })),
                value: valueItems.map((item) => ({ ...item, value: "" })),
              },
            ],
          }));

          // For edit, manually recurse with next ID
          // if (isEdit && forceSelectedId) {
          //   await handleCategorySelect(forceSelectedId, level + 1);
          // }

          if (!isEdit && categoryItems.length === 1) {
            const nextId = categoryItems[0].id;
            await handleCategorySelect(
              nextId,
              assetManager.categoryTree.length
            ); // recursion
          }
        }
      } else {
        if (result.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(result.message);
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    }
  };

  const handleDelete = async (ids) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const idString = idArray.join(",");
    const deletedCount = idArray.length;

    setAssetManager((prev) => ({ ...prev, isDeleting: true }));
    try {
      const response = await fetch(`${API_URL}/student/${idString}`, {
        method: "Delete",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      const handleResponse = () => {
        // Calculate new total
        const newTotalCount = assetManager.pagination.totalCount - deletedCount;
        const newTotalPages = Math.ceil(
          newTotalCount / assetManager.pagination.pageSize
        );

        // If current page is now invalid, move to last valid page
        const correctedPage =
          assetManager.pagination.page > newTotalPages
            ? newTotalPages
            : assetManager.pagination.page;

        setAssetManager((prev) => ({
          ...prev,
          pagination: {
            ...prev.pagination,
            page: correctedPage,
            totalPages: newTotalPages,
            totalCount: newTotalCount,
          },
        }));

        // Fetch data for corrected page
        fetchAssetData(correctedPage);
      };

      if (data.status === true) {
        toast.success(data.message || "Deleted successfully.", {
          autoClose: 1500,
          onClose: () => {
            handleResponse();
            setAssetManager((prev) => ({ ...prev, isDeleting: false }));
            setAssetManager((prev) => ({
              ...prev,
              deleteModal: { show: false, id: null },
              selectedRowIds: [],
            }));
          },
        });
      } else {
        if (data.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(data.message || "Failed to delete.", {
          autoClose: 1500,
          onClose: () => {
            setAssetManager((prev) => ({ ...prev, isDeleting: false }));
            setAssetManager((prev) => ({
              ...prev,
              deleteModal: { show: false, id: null },
            }));
          },
        });
      }

      fetchAssetData();
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, {
        autoClose: 1500,
        onClose: () => {
          setAssetManager((prev) => ({ ...prev, isDeleting: false }));
          setAssetManager((prev) => ({
            ...prev,
            deleteModal: { show: false, id: null },
          }));
        },
      });
    }
  };

  const handleCloseModal = () => {
    const modalEl = document.getElementById("addUserModal");
    if (modalEl) {
      const modalInstance = Modal.getOrCreateInstance(modalEl);
      modalInstance.hide(); // closes modal and removes backdrop
    }
    // console.log("hiii");
    // Optional safeguard for removing leftover backdrop and scroll lock
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.remove();
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("padding-right");
    }
  };

  const handleCloseBulkUploadModal = () => {
    const modalEl = document.getElementById("bulkUploadModal");
    if (modalEl) {
      const modalInstance = Modal.getOrCreateInstance(modalEl);
      modalInstance.hide(); // closes modal and removes backdrop
    }
    // console.log("hiii");
    // Optional safeguard for removing leftover backdrop and scroll lock
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.remove();
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("padding-right");
    }

    // Reset correct file input
    setAssetManager((prev) => ({ ...prev, bulkFile: null }));
    const fileInput = document.getElementById("formFile");
    if (fileInput) fileInput.value = null;
  };

  return (
    <div className="d-flex assetslocationmasterstable hms-app-shell">
      <SidebarDashboard />
      <div className="main-content flex-grow-1">
        <div className="container py-3 location-page hms-page">
          {/* Header Section */}
          <HeaderSection
            assetManager={assetManager}
            setAssetManager={setAssetManager}
            fetchDropDownValue={fetchDropDownValue}
          />

          {/* Table Section */}
          <AssetTable
            assetManager={assetManager}
            setAssetManager={setAssetManager}
            fetchAssetData={fetchAssetData}
            handleEdit={handleEdit}
          />

          {/* Footer */}
          <footer className="hms-app-footer">
            <img src="images/2cqrfooterlogo.png" alt="logo" />
            <span>2cqr &copy; 2025</span>
          </footer>

          {/* model */}
          <StudentForm
            assetManager={assetManager}
            setAssetManager={setAssetManager}
            fetchAssetData={fetchAssetData}
            handleCategorySelect={handleCategorySelect}
            handleCloseModal={handleCloseModal}
          />

          <div
            className="modal fade"
            id="bulkUploadModal"
            tabIndex="-1"
            data-bs-backdrop="static"
            data-bs-keyboard="false"
            aria-labelledby="bulkUploadModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-md">
              <div className="modal-content" style={{ borderRadius: "10px" }}>
                <div
                  className="modal-header pb-0"
                  style={{ borderBottom: "none" }}
                >
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                  ></button>
                </div>

                <div className="modal-body pt-2 pb-1">
                  <form>
                    <div className="mb-3">
                      <label
                        htmlFor="universitySelect"
                        className="form-label"
                        style={{ fontWeight: "bold", fontSize: "13px" }}
                      >
                        File Upload:
                      </label>
                    </div>

                    <div className="mb-3">
                      <input
                        className="form-control"
                        type="file"
                        id="formFile"
                        style={{ fontSize: "13px", height: "32px" }}
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* <div className="mb-3">
                      <a
                        href="/asset_sample_excel.xlsx"
                        download
                        style={{
                          color: "#0d6efd",
                          fontSize: "13px",
                          textDecoration: "none",
                        }}
                      >
                        Click to download Format
                      </a>
                    </div> */}

                    <label
                      className="form-label"
                      style={{ fontWeight: "bold", fontSize: "13px" }}
                    >
                      Download Format:
                    </label>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <a
                        href="/sample1.xlsx"
                        download
                        className="text-primary"
                        style={{ fontSize: "13px", textDecoration: "none" }}
                      >
                        <FaPlay
                          style={{
                            fontSize: "7px",
                            marginRight: "5px",
                            verticalAlign: "middle",
                          }}
                        />
                        Sample 1
                      </a>
                    </div>
                  </form>
                </div>

                <div
                  className="modal-footer pt-2 justify-content-end"
                  style={{ borderTop: "none" }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-bs-dismiss="modal"
                    style={{
                      fontSize: "13px",
                      padding: "6px 16px",
                      borderRadius: "4px",
                    }}
                    onClick={handleCloseBulkUploadModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      backgroundColor:
                        "linear-gradient(90deg, #005F9E, #1E90FF)",
                      border: "none",
                      fontSize: "13px",
                      padding: "6px 16px",
                      borderRadius: "4px",
                      cursor: assetManager.isSubmitting
                        ? "not-allowed"
                        : "pointer",
                    }}
                    onClick={handleBulkUpload}
                    disabled={assetManager.isSubmitting}
                  >
                    <span>Upload</span>
                    {assetManager.isSubmitting && (
                      <span
                        className="spinner-border spinner-border-sm ms-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {assetManager.deleteModal.show && (
            <DeleteModal
              assetManager={assetManager}
              setAssetManager={setAssetManager}
              handleDelete={handleDelete}
            />
          )}
        </div>
      </div>
      {/* Toaster Container */}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default StudentRegistration;
