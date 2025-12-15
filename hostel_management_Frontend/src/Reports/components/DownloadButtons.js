import React from "react";
import { API_URL } from "../../API_URL";
import { toast } from "react-toastify";
import errorHandlers from "../../utils/errorHandlers";
import { configReports } from "../../ReportsConfig";

const DownloadButtons = ({
  trackingState,
  setTrackingState,
  buildCommonQueryParams,
  reportKey,
}) => {
  const token = sessionStorage.getItem("accessToken");
  const reportConfig = configReports[reportKey];
  const exportTypes = reportConfig?.exportTypes || [];

  const initiateDownload = (blob, fileName) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleDownload = async (fileType = "excel") => {
    if (trackingState.isDownloading[fileType]) {
      toast.warning("Download in progress for this file type.");
      return;
    }

    setTrackingState((prev) => ({
      ...prev,
      isDownloading: { ...prev.isDownloading, [fileType]: true },
    }));

    try {
      const params = buildCommonQueryParams(
        trackingState.formData,
        trackingState.dropdownList
      );
      const query = new URLSearchParams({
        ...params,
        type: fileType,
      }).toString();

      const response = await fetch(`${API_URL}/report/${reportKey}?${query}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok)
        throw new Error(`Failed to download ${fileType.toUpperCase()} file.`);

      const blob = await response.blob();
      const fileMeta = exportTypes.find((type) => type.key === fileType);
      const extension = fileMeta?.ext || "dat";
      const fileName = `report_${new Date()
        .toISOString()
        .slice(0, 10)}.${extension}`;

      initiateDownload(blob, fileName);

      toast.success(`${fileType.toUpperCase()} file downloaded successfully`, {
        autoClose: 1500,
      });
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(
        error,
        `Failed to download ${fileType.toUpperCase()} file.`
      );
      toast.error(errorMessage, { autoClose: 1500 });
    } finally {
      setTrackingState((prev) => ({
        ...prev,
        isDownloading: { ...prev.isDownloading, [fileType]: false },
      }));
    }
  };

  return (
    <div className="d-flex justify-content-end">
      {exportTypes.map(({ key, label }) => {
        const isDownloading = trackingState.isDownloading[key];
        return (
          <button
            key={key}
            onClick={() => handleDownload(key)}
            disabled={isDownloading}
            style={{
              background: "linear-gradient(135deg, #7a4fc0, #4a90e2)",
              color: "#fff",
              border: "none",
              fontSize: "14px",
              padding: "8px 20px",
              borderRadius: "8px",
              cursor: isDownloading ? "not-allowed" : "pointer",
              boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease",
              marginRight: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              if (!isDownloading) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 5px 12px rgba(0,0,0,0.25)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.15)";
            }}
          >
            {label}
            {isDownloading && (
              <span
                className="spinner-border spinner-border-sm ms-2"
                role="status"
                style={{ marginLeft: "8px" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DownloadButtons;
