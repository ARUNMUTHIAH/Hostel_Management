import React, { useState } from "react";
import TableSkeleton from "../../TableSkeleton/TableSkeleton";
import Pagination from "../../Masters/components/Pagination";
import { API_URL } from "../../API_URL";

const StudentTable = ({
  assetManager,
  setAssetManager,
  fetchAssetData,
  handleEdit,
  masterKey = "Students",
}) => {
  const [bioMessage, setBioMessage] = useState(null); // Biometric notifications
  const [processingBiometric, setProcessingBiometric] = useState(false);

  const token = sessionStorage.getItem("accessToken");

  const handleBiometricClick = async (student) => {
    if (processingBiometric) return;

    setProcessingBiometric(true); // 🔒 disable immediately

    const isUpdate = !!student.bio_triggered_at;

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

        // enable button after 2s
        setTimeout(() => setProcessingBiometric(false), 5000);
        return;
      }

      setBioMessage({
        type: "info",
        text: `${isUpdate ? "Updating" : "Enrollment started"} for ${
          student.name
        }. Place finger on device.`,
      });

      // Wait for fingerprint status
      await waitForFingerprint(student.id, student.name, isUpdate);

      // enable button 2s after final message
      setTimeout(() => setProcessingBiometric(false), 5000);
    } catch (err) {
      console.error(err);
      setBioMessage({
        type: "error",
        text: "Unable to trigger biometric enrollment.",
      });

      // enable button after 2s
      setTimeout(() => setProcessingBiometric(false), 5000);
    }
  };

  const waitForFingerprint = (studentId, studentName, isUpdate) => {
    return new Promise((resolve) => {
      const pollInterval = 3000;
      const maxAttempts = 25;
      let attempts = 0;
      let completed = false;

      const interval = setInterval(async () => {
        if (completed) return;

        attempts++;

        try {
          const res = await fetch(
            `${API_URL}/student/fingerprint-status/${studentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const data = await res.json();

          if (data?.status && data?.fingerprint_enrolled) {
            completed = true;
            clearInterval(interval);

            setBioMessage({
              type: "success",
              text: isUpdate
                ? `Fingerprint updated successfully for ${studentName}.`
                : `Fingerprint enrolled successfully for ${studentName}.`,
            });

            setAssetManager((prev) => ({
              ...prev,
              assetData: prev.assetData.map((item) =>
                item.id === studentId
                  ? {
                      ...item,
                      bio_triggered_at: data.enrolled_at || new Date(),
                    }
                  : item
              ),
            }));

            setTimeout(() => setBioMessage(null), 5000);
            resolve(true);
            return; // 🔥 CRITICAL
          }

          /* ⛔ DO NOT overwrite success */
          if (completed) return;

          /* ℹ️ PROGRESS MESSAGES */
          if (data?.phase === "WAITING_FOR_TRIGGER") {
            setBioMessage({
              type: "info",
              text: "Preparing biometric device...",
            });
          } else if (data?.phase === "NO_BIODATA_YET") {
            setBioMessage({
              type: "info",
              text: "Place your finger on the device...",
            });
          } else {
            setBioMessage({
              type: "info",
              text: "Processing fingerprint...",
            });
          }

          /* ⏱ TIMEOUT */
          if (attempts >= maxAttempts) {
            completed = true;
            clearInterval(interval);

            setBioMessage({
              type: "warning",
              text: "Fingerprint processing is taking longer than usual.",
            });

            setTimeout(() => setBioMessage(null), 6000);
            resolve(false);
          }
        } catch (err) {
          completed = true;
          clearInterval(interval);

          setBioMessage({
            type: "error",
            text: "Unable to verify fingerprint status.",
          });

          setTimeout(() => setBioMessage(null), 6000);
          resolve(false);
        }
      }, pollInterval);
    });
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const allIds = checked
                      ? assetManager.assetData.map((item) => item.id)
                      : [];
                    const updatedAssets = assetManager.assetData.map(
                      (item) => ({
                        ...item,
                        selected: checked,
                      })
                    );

                    setAssetManager((prev) => ({
                      ...prev,
                      selectedRowIds: allIds,
                      assetData: updatedAssets,
                    }));
                  }}
                />
              </th>
              <th>S.No</th>
              <th>Name</th>
              <th>Member ID</th>
              <th>Parent Mobile</th>
              <th>Parent Email</th>
              {/* <th>Room No</th> */}
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {assetManager.loading ? (
              <TableSkeleton />
            ) : assetManager.assetData.length > 0 ? (
              assetManager.assetData.map((asset, index) => (
                <tr key={asset.id}>
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

                        const updatedAssets = assetManager.assetData.map(
                          (item) =>
                            item.id === asset.id
                              ? { ...item, selected: checked }
                              : item
                        );

                        setAssetManager((prev) => ({
                          ...prev,
                          selectedRowIds: updatedIds,
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
                  <td>{asset.parentcontact}</td>
                  <td>{asset.parentemail}</td>
                  {/* <td>{asset?.locations?.map((l) => l.name).join(", ")}</td> */}

                  <td
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <button
                      className="btn btn-edit btn-sm"
                      onClick={() => handleEdit(asset.id)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      className="btn btn-delete btn-sm"
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
                      disabled={processingBiometric} // Disable ALL buttons when processing
                      style={{
                        width: "120px",
                        background: "linear-gradient(90deg, #1E90FF, #00BFFF)",
                        border: "none",
                        borderRadius: "5px",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                        opacity: processingBiometric ? 0.6 : 1,
                        cursor: processingBiometric ? "not-allowed" : "pointer",
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
                <td colSpan="8" className="text-center py-3">
                  No Data Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        masterKey={masterKey}
        assetMasters={{
          page: assetManager.pagination.page,
          totalCount: assetManager.pagination.totalCount,
          pageSize: assetManager.pagination.pageSize,
          totalPages: assetManager.pagination.totalPages,
          loading: assetManager.loading,
        }}
        onPageChange={(typeOrPageNum) => {
          let newPage;
          if (typeOrPageNum === "next")
            newPage = Math.min(
              assetManager.pagination.page + 1,
              assetManager.pagination.totalPages
            );
          else if (typeOrPageNum === "prev")
            newPage = Math.max(assetManager.pagination.page - 1, 1);
          else newPage = typeOrPageNum;

          setAssetManager((prev) => ({
            ...prev,
            assetData: [],
            selectedRowIds: [],
            pagination: { ...prev.pagination, page: newPage },
          }));

          fetchAssetData(newPage, assetManager.pagination.pageSize);
        }}
      />

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
