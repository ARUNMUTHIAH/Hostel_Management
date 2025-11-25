/* eslint-disable no-unused-vars */
import React from "react";
import "react-toastify/dist/ReactToastify.css";
import { Modal } from "bootstrap";
import { toast } from "react-toastify";

const HeaderSection = ({
  assetManager,
  setAssetManager,
  fetchDropDownValue,
}) => {
  const openBulkUploadModal = () => {
    const modalElement = document.getElementById("bulkUploadModal");
    const modalInstance = Modal.getOrCreateInstance(modalElement);
    modalInstance.show();
  };

  return (
    <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap">
      {/* Left side - Title and buttons */}
      <div>
        <h5 className="mb-2 locationtopbar">
          {sessionStorage.getItem("activeSidebarName") || "Assets"}
        </h5>
        <button
          className="btn btn-add"
          onClick={() => {
            fetchDropDownValue();
            const modalElement = document.getElementById("addUserModal");
            const modalInstance = Modal.getOrCreateInstance(modalElement);
            modalInstance.show();
          }}
        >
          Add New +
        </button>

        <button
          className="btn btn-deletion ms-2"
          disabled={assetManager.isDeleting || assetManager.toastActive}
          data-bs-toggle=""
          data-bs-target=""
          onClick={() => {
            const selectedIds = assetManager.assetData
              .filter((item) => item.selected)
              .map((item) => item.id);

            if (assetManager.selectedRowIds.length === 0) {
              if (!assetManager.toastActive) {
                setAssetManager((prev) => ({ ...prev, toastActive: true }));
                toast.info("Please select at least one asset to delete.", {
                  autoClose: 2000,
                  onClose: () =>
                    setAssetManager((prev) => ({
                      ...prev,
                      toastActive: false,
                    })),
                });
              }
              return;
            } else {
              setAssetManager((prev) => ({
                ...prev,
                deleteModal: { show: true, id: selectedIds },
              }));
            }
          }}
        >
          Delete
        </button>
      </div>

      {/* Right side - Search bar and action buttons */}
      <div>
        {/* Search bar slightly moved up */}
        <div className="search-box position-relative mb-2 searchboxassetmoveup">
          <i
            className="bi bi-search search-icon position-absolute"
            style={{
              top: "50%",
              left: "10px",
              transform: "translateY(-50%)",
            }}
          ></i>
          <input
            type="text"
            className="form-control ps-5"
            placeholder="Search"
            style={{ height: "30px", fontSize: "13px", width: "220px" }}
            onChange={(e) => {
              const value = e.target.value.trimStart().replace(/\s+$/, "");
              setAssetManager((prev) => ({ ...prev, searchTerm: value }));
            }}
          />
        </div>

        {/* Buttons under the search bar */}
        <div className="d-flex justify-content-end gap-2 mt-2">
          {/* Excel Button */}
          {/* <a
                  href="/asset_sample_excel.xlsx"
                  download
                  className="btn btn-outline-dark"
                  style={{
                    padding: "4px 12px",
                    height: "30px",
                    fontSize: "13px",
                    borderRadius: "4px",
                  }}
                >
                  Sample Excel <i className="bi bi-card-list ms-1"></i>
                </a> */}

          {/* Bulk Upload Button */}
          <button
            className="btn btn-teal btntealassetfp"
            data-bs-toggle="modal"
            data-bs-target="#bulkUploadModal"
            onClick={openBulkUploadModal}
            style={{
              padding: "4px 12px",
              height: "30px",
              fontSize: "13px",
              borderRadius: "4px",
            }}
          >
            Bulk Upload <i className="bi bi-upload ms-1"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeaderSection;
