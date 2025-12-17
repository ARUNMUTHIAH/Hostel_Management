/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useState } from "react";
import TableSkeleton from "../../TableSkeleton/TableSkeleton";
import Pagination from "../../Masters/components/Pagination";
import { API_URL } from "../../API_URL";
import { toast } from "react-toastify";

const StudentTable = ({
  assetManager,
  setAssetManager,
  fetchAssetData,
  handleEdit,
  masterKey = "Students",
}) => {
  const [bioMessage, setBioMessage] = useState(null); // For showing biometric notification

  const token = sessionStorage.getItem("accessToken"); // 🔹 get token from storage

  const handleBiometricClick = async (student) => {
    try {
      const res = await fetch(
        `${API_URL}/student/trigger-enroll/${student.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok || !data.status) {
        setBioMessage({
          type: "error",
          text: data?.message || "Failed to trigger enrollment",
        });
        return;
      }

      setBioMessage({
        type: "info",
        text: `Enrollment started for ${student.name}. Place finger on device.`,
      });

      // Wait for fingerprint and update the button label
      waitForFingerprint(student.id, student.name, student);
    } catch (err) {
      console.error(err);
      setBioMessage({
        type: "error",
        text: "Unable to trigger biometric enrollment.",
      });
    }
  };

  // Updated waitForFingerprint to update local asset state
  const waitForFingerprint = (studentId, studentName, studentObj) => {
    const pollInterval = 3000;
    const maxAttempts = 25;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const res = await fetch(
          `${API_URL}/student/fingerprint-status/${studentId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();

        if (data.status && data.fingerprint_enrolled) {
          clearInterval(interval);
          setBioMessage({
            type: "success",
            text: `Fingerprint enrolled successfully for ${studentName}.`,
          });

          // ✅ Update local asset state so button shows "Update Finger"
          setAssetManager((prev) => ({
            ...prev,
            assetData: prev.assetData.map((item) =>
              item.id === studentId
                ? { ...item, bio_triggered_at: data.enrolled_at || new Date() }
                : item
            ),
          }));

          setTimeout(() => setBioMessage(null), 5000);
          return;
        }

        // Phase-based messages
        switch (data.phase) {
          case "WAITING_FOR_TRIGGER":
            setBioMessage({
              type: "info",
              text: "Preparing biometric device...",
            });
            break;
          case "NO_BIODATA_YET":
            setBioMessage({
              type: "info",
              text: "Place your finger on the device...",
            });
            break;

          default:
            setBioMessage({ type: "info", text: "Processing fingerprint..." });
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setBioMessage({
            type: "warning",
            text: "Fingerprint processing is taking longer than usual. If device shows success, no action needed.",
          });
          setTimeout(() => setBioMessage(null), 6000);
        }
      } catch (err) {
        clearInterval(interval);
        setBioMessage({
          type: "error",
          text: "Unable to verify fingerprint status.",
        });
        setTimeout(() => setBioMessage(null), 6000);
      }
    }, pollInterval);
  };

  const handlePageChange = (typeOrPageNum) => {
    let newPage;

    if (typeOrPageNum === "next") {
      newPage = Math.min(
        assetManager.pagination.page + 1,
        assetManager.pagination.totalPages
      );
    } else if (typeOrPageNum === "prev") {
      newPage = Math.max(assetManager.pagination.page - 1, 1);
    } else {
      newPage = typeOrPageNum;
    }

    setAssetManager((prev) => ({
      ...prev,
      assetData: [],
      selectedRowIds: [],
      pagination: {
        ...prev.pagination,
        page: newPage,
      },
    }));

    fetchAssetData(newPage, assetManager.pagination.pageSize);
  };

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    const allIds = checked ? assetManager.assetData.map((item) => item.id) : [];

    const updatedAssets = assetManager.assetData.map((item) => ({
      ...item,
      selected: checked,
    }));

    setAssetManager((prev) => ({
      ...prev,
      selectedRowIds: allIds,
      assetData: updatedAssets,
    }));
  };

  return (
    <div className="table-container">
      <div className="table-responsive">
        <table className="table mb-0">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>
                <input
                  type="checkbox"
                  checked={
                    !assetManager.loading &&
                    assetManager.assetData.length > 0 &&
                    assetManager.assetData.every((item) =>
                      assetManager.selectedRowIds.includes(item.id)
                    )
                  }
                  onChange={handleSelectAllChange}
                />
              </th>
              <th>S.No</th>
              <th>Name</th>
              <th>Member ID</th>
              <th>Mobile No</th>
              <th>Room No</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {assetManager.loading ? (
              <TableSkeleton />
            ) : Array.isArray(assetManager.assetData) &&
              assetManager.assetData.length > 0 ? (
              assetManager.assetData.map((asset, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="checkbox"
                      checked={assetManager.selectedRowIds.includes(asset.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updatedIds = checked
                          ? [...assetManager.selectedRowIds, asset.id]
                          : assetManager.selectedRowIds.filter(
                              (id) => id !== asset.id
                            );

                        setAssetManager((prev) => ({
                          ...prev,
                          selectedRowIds: updatedIds,
                        }));

                        const updatedAssets = assetManager.assetData.map(
                          (item) =>
                            item.id === asset.id
                              ? { ...item, selected: checked }
                              : item
                        );

                        setAssetManager((prev) => ({
                          ...prev,
                          assetData: updatedAssets,
                        }));
                      }}
                    />
                  </td>

                  <td>
                    {(assetManager.pagination.page - 1) *
                      assetManager.pagination.pageSize +
                      index +
                      1}
                  </td>

                  <td>{asset.name}</td>
                  <td>{asset.memberid}</td>
                  <td>{asset.mobile}</td>
                  <td>{asset?.locations?.map((l) => l.name).join(", ")}</td>

                  <td
                    style={{
                      textAlign: "center",
                      display: "flex",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <button
                      className="btn btn-edit btn-sm"
                      style={{
                        width: "36px",
                        display: "flex",
                        justifyContent: "center",
                      }}
                      onClick={() => handleEdit(asset.id)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      className="btn btn-delete btn-sm"
                      style={{
                        width: "36px",
                        display: "flex",
                        justifyContent: "center",
                      }}
                      onClick={() =>
                        setAssetManager((prev) => ({
                          ...prev,
                          deleteModal: { show: true, id: asset.id },
                        }))
                      }
                    >
                      <i className="bi bi-trash"></i>
                    </button>

                    <button
                      className="btn btn-sm text-white"
                      style={{
                        width: "120px",
                        background: "linear-gradient(90deg, #1E90FF, #00BFFF)",
                        border: "none",
                        padding: "4px 0",
                        borderRadius: "5px",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => handleBiometricClick(asset)}
                    >
                      <i className="bi bi-person-bounding-box me-1"></i>
                      {asset.bio_triggered_at
                        ? "Update Finger"
                        : "Enroll Finger"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-3">
                  No Data Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        masterKey={masterKey}
        assetMasters={{
          page: assetManager.pagination.page,
          totalCount: assetManager.pagination.totalCount,
          pageSize: assetManager.pagination.pageSize,
          totalPages: assetManager.pagination.totalPages,
          loading: assetManager.loading,
        }}
        onPageChange={handlePageChange}
      />

      {/* Biometric Notification */}
      {bioMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            background: "#1E90FF",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "250px",
          }}
        >
          <i
            className="bi bi-person-bounding-box"
            style={{ fontSize: "20px" }}
          ></i>
          <span>{bioMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default StudentTable;
