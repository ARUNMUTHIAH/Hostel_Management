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

  const pageName = sessionStorage.getItem("activeSidebarName") || "Assets";

  return (
    <div className="hms-page-shell">
      <div className="hms-page-band">
        <div className="hms-page-header__title-row">
          <div className="hms-page-header__icon">
            <i className="bi bi-person-vcard-fill"></i>
          </div>
          <div>
            <h5 className="hms-page-title locationtopbar">{pageName}</h5>
            <p className="hms-page-subtitle">Student registration and management</p>
          </div>
        </div>
      </div>
      <div className="hms-action-band">
        <div className="hms-action-band__left">
          <button
            className="btn btn-add"
            onClick={() => {
              fetchDropDownValue();
              const modalElement = document.getElementById("addUserModal");
              const modalInstance = Modal.getOrCreateInstance(modalElement);
              modalInstance.show();
            }}
          >
            <i className="bi bi-plus-lg me-1"></i> Add New
          </button>
          <button
            className="btn btn-deletion"
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
            <i className="bi bi-trash me-1"></i> Delete
          </button>
          <button
            className="btn btn-add"
            data-bs-toggle="modal"
            data-bs-target="#bulkUploadModal"
            onClick={openBulkUploadModal}
          >
            <i className="bi bi-upload me-1"></i> Bulk Upload
          </button>
        </div>

        <div className="hms-action-band__right">
          <div className="hms-search-box searchboxassetmoveup">
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="form-control"
              placeholder="Search students..."
              onChange={(e) => {
                const value = e.target.value.trimStart().replace(/\s+$/, "");
                setAssetManager((prev) => ({ ...prev, searchTerm: value }));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderSection;
