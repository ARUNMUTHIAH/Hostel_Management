/* eslint-disable eqeqeq */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useState, useRef } from "react";
import errorHandlers from "../utils/errorHandlers";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { API_URL } from "../API_URL";
import "react-toastify/dist/ReactToastify.css";
import "./masterstable.css";
import SidebarDashboard from "../Sidebar/sidebar";
import Header from "../Header/header";
import { masterConfig } from "./masterConfig";
import MasterHeader from "./components/MasterHeader";
import { MasterTable } from "./components/MasterTable";
import Pagination from "./components/Pagination";
import MasterFormModal from "./components/MasterFormModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import { handleTokenExpired } from "../utils/errorHandlers";
import { Modal } from "bootstrap";

const pageSize = 10;

const Masters = () => {
  const { masterKey } = useParams();
  const configMasters = masterConfig[masterKey];
  const debounceRef = useRef(null);
  const token = sessionStorage.getItem("accessToken");
  const navigate = useNavigate();
  const [fieldOptions, setFieldOptions] = useState({});

  console.log("fieldoptions", fieldOptions);

  //handel table
  const [assetMasters, setAssetMasters] = useState({
    list: [],
    loading: false,
    selectAll: false,
    selectedIds: [],
    searchText: "",
    page: 1,
    pageSize: pageSize,
    totalPages: 0,
    totalCount: 0,
  });

  // handel form
  const [masterChanges, setMasterChanges] = useState({
    mode: "add",
    added: {}, // form data (for both add/edit)
    originalData: {},
    delete: {
      show: false,
      ids: [],
      loading: false,
      toastActive: false,
    },
    isSubmitting: false,
    selectAll: false,
    showPasswordInput: false, // for password edit
  });

  useEffect(() => {
    fetchFieldOptions();
    setAssetMasters((pre) => {
      return {
        ...pre,
        page: 1,
        selectedIds: [],
        selectAll: false,
        searchText: "",
      };
    });
    fetchData(1, "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  const fetchFieldOptions = async () => {
    const options = {};

    if (Array.isArray(configMasters)) {
      for (const field of configMasters) {
        const key = field.bkname;

        if (key === "status") {
          options[key] = [
            { id: "1", name: "Active" },
            { id: "0", name: "Inactive" },
          ];
          continue; //Skip the rest for this field
        }

        if (field.apilink) {
          try {
            const response = await fetch(field.apilink, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            const result = await response.json();
            if (result.status && Array.isArray(result.data)) {
              options[key] = result.data;
            }
            if (!result.status) {
              if (result.message === "Token expired") {
                handleTokenExpired();
                return;
              }
              toast.error(result.message || "Internal server error");
            }
          } catch (err) {
            console.error(`Error fetching options for ${key}:`, err);
          }
        }
      }
    }
    setFieldOptions(options);
  };

  const fetchData = async (
    page = assetMasters.page,
    search = assetMasters.searchText
  ) => {
    setAssetMasters((prev) => ({ ...prev, loading: true }));
    const url = `${API_URL}/${masterKey}?pagesize=${pageSize}&page=${page}&search=${search}`;
    try {
      const response = await fetch(url, {
        method: "get",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      if (result.status) {
        const { data, count } = result;

        const currentPageIds = data.map((item) => item.id);
        const isSelectAll =
          currentPageIds.length > 0 &&
          currentPageIds.every((id) => assetMasters.selectedIds.includes(id));
        console.log({ isSelectAll }, currentPageIds, assetMasters.selectedIds);

        setAssetMasters((prev) => ({
          ...prev,
          page: page,
          list: data,
          totalPages: Math.ceil(count / pageSize), // change re pagiantion to count
          totalCount: count, // change count
          loading: false,
          selectAll: isSelectAll,
        }));
      } else if (!result.status) {
        if (result.message === "Token expired") {
          handleTokenExpired();
          return;
        } else if (result.message === "Invalid table name") {
          setTimeout(() => {
            navigate("/nopagefound");
          }, 2000);
          return;
        }

        toast.error(result.message || "Internal server error");
        setAssetMasters((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch master data."
      );
      toast.error(errorMessage, { autoClose: 2000 });

      setAssetMasters((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleEdit = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${masterKey}?id=${id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.status) {
        const data = result.data;

        setMasterChanges((pre) => ({
          ...pre,
          mode: "edit",
          added: data,
          originalData: data, // Keep untouched original
          isSubmitting: false,
        }));

        // const modal = new window.bootstrap.Modal(document.getElementById("addUserModal"));
        // modal.show();

        const modalElement = document.getElementById("addUserModal");
        const modalInstance = Modal.getOrCreateInstance(modalElement);
        modalInstance.show();
      } else {
        if (result.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(result.message || "Error fetching data");
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch master data."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    }
  };

  const handleDeleteRequest = () => {
    if (assetMasters.selectedIds.length === 0) {
      if (!masterChanges.delete.toastActive) {
        setMasterChanges((prev) => ({
          ...prev,
          delete: { ...prev.delete, toastActive: true },
        }));

        toast.info(`Please select at least one ${masterKey} to delete.`, {
          autoClose: 1000,
          onClose: () =>
            setMasterChanges((prev) => ({
              ...prev,
              delete: { ...prev.delete, toastActive: false },
            })),
        });
      }
      return;
    }

    setMasterChanges((prev) => ({
      ...prev,
      delete: {
        show: true,
        ids: assetMasters.selectedIds,
        loading: false,
        toastActive: false,
      },
    }));
  };

  const handleDelete = async () => {
    const idsToDelete = masterChanges.delete.ids;

    if (!idsToDelete.length) return;

    setMasterChanges((prev) => ({
      ...prev,
      delete: { ...prev.delete, loading: true },
    }));

    try {
      const response = await fetch(
        `${API_URL}/${masterKey}/${idsToDelete.join(",")}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (result.status) {
        toast.success(result.message || "Deleted successfully", {
          autoClose: 2000,
          onClose: () => {
            const remaining = assetMasters.totalCount - idsToDelete.length;
            const newTotalPages = Math.ceil(remaining / assetMasters.pageSize);
            const newPage = Math.min(assetMasters.page, newTotalPages || 1);

            setMasterChanges((prev) => ({
              ...prev,
              delete: { show: false, ids: [], loading: false },
            }));

            setAssetMasters((prev) => ({
              ...prev,
              selectedIds: prev.selectedIds.filter(
                (id) => !idsToDelete.includes(id)
              ),
              page: newPage,
            }));

            fetchData(newPage);
          },
        });
      } else {
        if (result.message === "Token expired") {
          handleTokenExpired();
          return;
        }
        toast.error(result.message || "Delete failed");
        setMasterChanges((prev) => ({
          ...prev,
          delete: { ...prev.delete, loading: false },
        }));
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch master data."
      );
      toast.error(errorMessage, { autoClose: 2000 });

      setMasterChanges((prev) => ({
        ...prev,
        delete: { ...prev.delete, loading: false },
      }));
    }
  };

  const handleSingleDelete = (id) => {
    setMasterChanges((prev) => ({
      ...prev,
      delete: {
        show: true,
        ids: [id],
        loading: false,
      },
    }));
  };

  const handleSearchInput = (e) => {
    const value = e.target.value.trimStart().replace(/\s+$/, "");

    setAssetMasters((prev) => ({
      ...prev,
      searchText: value,
      page: 1,
    }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchData(1, value);
      setAssetMasters((prev) => ({
        ...prev,
        selectAll: false,
        selectedIds: [],
      }));
    }, 2000);
  };

  const handleInputChange = (bkname, value) => {
    let newValue = value;

    if (bkname === "mobileno") {
      newValue = value.replace(/\D/g, "").slice(0, 10);
    }

    setMasterChanges((prev) => {
      let updatedAdded = {
        ...prev.added,
        [bkname]: newValue,
      };

      // ✅ If role is SuperAdmin, clear and disable centers
      if (bkname === "role_id") {
        const selectedRole = fieldOptions["role_id"]?.find(
          (r) => r.id == newValue
        );
        if (selectedRole?.name?.toLowerCase() === "superadmin") {
          updatedAdded["location"] = []; // Clear centers if SuperAdmin
        }
      }

      return {
        ...prev,
        added: updatedAdded,
      };
    });
  };

  // const handleInputChange = (bkname, value) => {
  //   let newValue = value;

  //   if (bkname === "mobileno") {
  //     newValue = value.replace(/\D/g, "").slice(0, 10);
  //   }

  //   setMasterChanges((prev) => ({
  //     ...prev,
  //     added: {
  //       ...prev.added,
  //       [bkname]: newValue,
  //     },
  //   }));
  // };

  const handleCheckboxChange = (id) => {
    setAssetMasters((prev) => {
      const selected = prev.selectedIds;
      const updatedSelected = selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id];

      return {
        ...prev,
        selectedIds: updatedSelected,
        selectAll: updatedSelected.length === prev.list.length,
      };
    });
  };

  // Handle select all checkbox
  const handleSelectAll = (checked) => {
    setAssetMasters((prev) => {
      const allIds = prev.list.map((item) => item.id);
      return {
        ...prev,
        selectedIds: checked ? allIds : [],
        selectAll: checked,
      };
    });
  };

  const handlePageChange = (newPage) => {
    setAssetMasters((prev) => ({
      ...prev,
      page: newPage,
      selectedIds: [],
    }));
    fetchData(newPage);
  };

  return (
    <div className="d-flex assetslocationmasterstable">
      <Header />
      <SidebarDashboard />
      <div className="main-content flex-grow-1" style={{ marginTop: "56px" }}>
        <div className="container my-4 location-page">
          {/* Header Section */}
          <MasterHeader
            masterKey={masterKey}
            assetMasters={assetMasters}
            handleSearchInput={handleSearchInput}
            onDeleteClick={handleDeleteRequest}
            masterChanges={masterChanges}
          />

          <div className="table-container">
            {/* Table Section */}
            <MasterTable
              configMasters={configMasters}
              assetMasters={assetMasters}
              onhandleSelectAll={handleSelectAll}
              onCheckboxChange={handleCheckboxChange}
              onEdit={handleEdit}
              onDelete={handleSingleDelete}
            />

            {/* Pagination */}
            <Pagination
              masterKey={masterKey}
              assetMasters={assetMasters}
              onPageChange={handlePageChange}
            />
          </div>

          {/* Footer */}
          <footer className="mt-4 lastassettrackingfooter d-flex align-items-center gap-2">
            <img src="images/2cqrfooterlogo.png" alt="logo" width="30" />
            <strong>2cqr &copy; 2025</strong>
          </footer>

          {/* Form Add / Edit Modal */}
          <MasterFormModal
            configMasters={configMasters}
            masterChanges={masterChanges}
            setMasterChanges={setMasterChanges}
            onInputChange={handleInputChange}
            masterKey={masterKey}
            fetchData={fetchData}
            fieldOptions={fieldOptions}
            handleTokenExpired={handleTokenExpired}
          />

          {/* Delete model */}
          {masterChanges.delete.show && (
            <DeleteConfirmModal
              setMasterChanges={setMasterChanges}
              masterChanges={masterChanges}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default Masters;
