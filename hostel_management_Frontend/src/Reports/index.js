import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SidebarDashboard from "../Sidebar/sidebar";
import Header from "../Header/header";
import errorHandlers, { handleTokenExpired } from "../utils/errorHandlers";
import { configReports } from "../ReportsConfig";
import { API_URL } from "../API_URL";

import ReportTable from "./components/ReportTable";
import PaginationControls from "./components/PaginationControls";
import DownloadButtons from "./components/DownloadButtons";
import FilterSection from "./components/FilterSection";

import "./index.css";

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const formattedToday = `${yyyy}-${mm}-${dd}`; // "2025-12-31"

const getInitialTrackingState = () => ({
  formData: { fromDate: formattedToday, toDate: formattedToday },
  dropdownList: {},
  tableData: null,
  pagination: { page: 1, pageSize: 10, totalPages: 0, totalRecords: 0 },
  isLoading: false,
  isDownloading: { excel: false, pdf: false },
  showTable: false,
  expandedRow: null,
});

const ReportPage = () => {
  const token = sessionStorage.getItem("accessToken");
  const { reportKey } = useParams();
  const reportConfig = configReports[reportKey];
  const navigate = useNavigate();

  const [trackingState, setTrackingState] = useState(getInitialTrackingState());

  const setStateField = (key, value) =>
    setTrackingState((prev) => ({ ...prev, [key]: value }));

  const fetchProductList = async () => {
    try {
      const response = await fetch(`${API_URL}/dropdown/product_type`, {
        method: "post",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (data.message === "Token expired") {
        handleTokenExpired();
        return null;
      }
      setTrackingState((prev) => ({
        ...prev,
        dropdownList: { ...prev.dropdownList, product_types: data.data },
      }));
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, { autoClose: 1000 });
    }
  };

  const fetchDropdownOptions = async () => {
    const options = {};
    const reportFields = reportConfig?.fields || [];
    for (const field of reportFields) {
      const key = field.bkname;

      if (key === "status") {
        options[key] = [
          { id: 1, name: "Active" },
          { id: 0, name: "Inactive" },
        ];
        continue; // Skip the rest for this field
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
            // ✅ Special case for SMSLog user dropdown
            if (reportKey === "smslog" && key === "created_by") {
              options[key] = result.data.map((item) => ({
                id: item.id,
                name: item.username, // use username instead of name
              }));
            } else {
              options[key] = result.data;
            }
          } else if (!result.status) {
            if (result.message === "Token expired") {
              handleTokenExpired();
              return;
            }
          }
        } catch (err) {
          console.error(`Error fetching options for ${key}:`, err);
        }
      }
    }
    setTrackingState((prev) => ({
      ...prev,
      dropdownList: {
        ...prev.dropdownList,
        ...options,
      },
    }));
  };

  const fetchCategoryList = async (id = "") => {
    try {
      const response = await fetch(`${API_URL}/dropdown/product_type`, {
        method: "post",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent_id: id }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Filter out items with type === "V"
      const filteredOptions = (data.data || []).filter(
        (item) => item.type !== "V"
      );

      // setDropdownList((pre) => ({...pre, { option: data.data }}))
      setTrackingState((prev) => ({
        ...prev,
        dropdownList: {
          ...prev.dropdownList,
          categories: [
            ...(prev.dropdownList.categories || []),
            { option: filteredOptions },
          ],
        },
      }));

      if (data.message === "Token expired") {
        handleTokenExpired();
        return null;
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    }
  };

  const buildCommonQueryParams = (formData, dropdownList) => {
    const subCategoryOptions = dropdownList?.categories?.flatMap((cat) => {
      const options = cat.option || [];
      const allHaveValueOnly = options.every(
        (opt) => "value" in opt && !("name" in opt)
      );
      return options.filter((opt) => {
        // If the whole group has only value keys, include all
        if (allHaveValueOnly) return "value" in opt;
        // Otherwise, only include value + active: true
        return "value" in opt && opt.active === true;
      });
    });

    const subcategory = subCategoryOptions?.map((opt) => opt.id).join(",");

    const selectedOptions = dropdownList.categories
      ?.map((cat) => cat.option.find((opt) => opt.active && "name" in opt))
      .filter(Boolean);

    const categories = selectedOptions
      ?.map((item) => Number(item.id))
      .join(",");

    const dynamicFields = {};
    reportConfig.fields.forEach((field) => {
      if (field.bkname !== "category" && field.bkname !== "subcategory") {
        dynamicFields[field.bkname] = formData?.[field.bkname] ?? "";
      }
    });

    return {
      ...dynamicFields,
      category: categories || "",
      subcategory: subcategory || "",
    };
  };

  const fetchTableData = async (
    page = trackingState.pagination.page,
    pageSize = trackingState.pagination.pageSize,
    fromUserAction = true,
    searchOnly = false // new flag
  ) => {
    if (fromUserAction) setStateField("isLoading", true);

    if (trackingState.formData.toDate < trackingState.formData.fromDate) {
      toast.error("To Date cannot be earlier than From Date", {
        autoClose: 1500,
        onClose: () => setStateField("isLoading", false),
      });
      return;
    }

    try {
      const params = buildCommonQueryParams(
        trackingState.formData,
        trackingState.dropdownList
      );

      // If this is a search/filter action, don't send page & pagesize
      const query = Object.entries({
        ...params,
        ...(searchOnly ? {} : { pagesize: pageSize, page }),
      })
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      const response = await fetch(`${API_URL}/report/${reportKey}?${query}`, {
        method: "post",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.status) {
        if (Array.isArray(data.data) && data.data.length === 0) {
          toast.info("No data found for the selected filters.", {
            autoClose: 1500,
          });
          return;
        }

        setTrackingState((prev) => ({
          ...prev,
          tableData: data.data,
          showTable: true,
          pagination: {
            ...prev.pagination,
            totalRecords: data.count,
            totalPages: Math.ceil(
              data.count / trackingState.pagination.pageSize
            ),
            page: searchOnly ? 1 : page, // reset to first page on new search
          },
        }));
      } else {
        if (data.message === "Token expired") return handleTokenExpired();
        toast.error(data.message || "Error generating data", {
          autoClose: 1500,
        });
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch data."
      );
      toast.error(errorMessage, { autoClose: 2000 });
    } finally {
      if (fromUserAction) setStateField("isLoading", false);
    }
  };

  const handleClearFilters = () => {
    setTrackingState((prev) => ({
      ...getInitialTrackingState(),
      dropdownList: {
        ...prev.dropdownList,
        product_types: prev.dropdownList.product_types || [],
        // preserve any other dropdowns if needed
      },
    }));
  };

  useEffect(() => {
    if (!reportConfig) {
      return navigate("/nopagefound");
    }
    setTrackingState(getInitialTrackingState());
    fetchProductList();
    fetchDropdownOptions();
    // eslint-disable-next-line
  }, [reportKey]);

  return (
    <div className="d-flex lastassettracking">
      <Header />
      <SidebarDashboard />
      <div className="main-content flex-grow-1" style={{ marginTop: "56px" }}>
        <div className="container py-4">
          <h5 className="fw-bold mb-3">
            {sessionStorage.getItem("activeSidebarName") ||
              "AGRICULTURAL ENGINEERING COLLEGE & RESEARCH INSTITUTE"}
          </h5>

          <div className="card p-4">
            <div className="row g-4">
              {/* Info message */}
              <div className="col-12">
                <div className="alert alert-info mb-3" role="alert">
                  <strong>Note:</strong> If you click <em>Submit</em> without
                  selecting any filter, all data will be fetched.
                </div>
              </div>

              <FilterSection
                reportConfig={reportConfig}
                fetchCategoryList={fetchCategoryList}
                setTrackingState={setTrackingState}
                trackingState={trackingState}
              />

              {/* Buttons */}
              <div className="col-md-4 d-flex align-items-start justify-content-start">
                <div className="btn-wrapper btnwrapperlastassettracking">
                  {/* <button
                    className="btn btn-submit lastassettrackingsubmitbtn"
                    onClick={() => fetchTableData()}
                    disabled={
                      trackingState.isLoading || trackingState.showTable
                    }
                  >
                    <span>Submit</span>
                    {trackingState.isLoading && (
                      <span
                        className="spinner-border spinner-border-sm ms-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                    )}
                  </button> */}
                  {/* //before that filter page no size sending  */}

                  <button
                    className="btn btn-submit lastassettrackingsubmitbtn"
                    onClick={() =>
                      fetchTableData(undefined, undefined, true, true)
                    } // ✅ searchOnly = true
                    disabled={trackingState.isLoading}
                  >
                    <span>Submit</span>
                    {trackingState.isLoading && (
                      <span
                        className="spinner-border spinner-border-sm ms-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                    )}
                  </button>

                  <button
                    className="btn btn-cancel lastassettrackingcancelbtn me-2"
                    onClick={() => handleClearFilters()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          {trackingState.showTable && (
            <div className="container mt-3">
              <DownloadButtons
                trackingState={trackingState}
                setTrackingState={setTrackingState}
                buildCommonQueryParams={buildCommonQueryParams}
                reportKey={reportKey}
              />

              <div className="d-flex justify-content-between align-items-center mt-3">
                <h5>
                  <strong>Institute</strong>
                </h5>
              </div>

              <div className="table-container mt-4">
                <div className="table-responsive">
                  <ReportTable
                    reportConfig={reportConfig}
                    trackingState={trackingState}
                    setTrackingState={setTrackingState}
                  />

                  {/* Pagination */}
                  <PaginationControls
                    trackingState={trackingState}
                    setTrackingState={setTrackingState}
                    fetchTableData={fetchTableData}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-4 lastassettrackingfooter d-flex align-items-center gap-2">
          <img src="../images/2cqrfooterlogo.png" alt="logo" width="30" />
          <strong>2cqr &copy; 2025</strong>
        </footer>
      </div>

      <ToastContainer />
    </div>
  );
};

export default ReportPage;
