import React from 'react'
import { API_URL } from '../../API_URL';
import { toast } from "react-toastify";
import errorHandlers from '../../utils/errorHandlers';
import { configReports } from '../../ReportsConfig';

const DownloadButtons = ({ trackingState, setTrackingState, buildCommonQueryParams, reportKey }) => {
    const token = sessionStorage.getItem("accessToken");
    const reportConfig = configReports[reportKey];
    const exportTypes = reportConfig?.exportTypes || [];

    const isDownloadingAny = Object.values(trackingState.isDownloading).some(Boolean);

    const initiateDownload = (blob, fileName) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
    };

    const handleDownload = async (fileType = "excel") => {
        if (isDownloadingAny) {
            toast.warning("Please wait until the current file finishes downloading.");
            return;
        }
        setTrackingState(prev => ({ ...prev, isDownloading: { ...prev.isDownloading, [fileType]: true } }));

        try {
            const params = buildCommonQueryParams(trackingState.formData, trackingState.dropdownList);
            const query = new URLSearchParams({ ...params, type: fileType }).toString();

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
            const extension = fileMeta?.ext || 'dat';
            const fileName = `report_${new Date().toISOString().slice(0, 10)}.${extension}`;

            initiateDownload(blob, fileName);

            toast.success(`${fileType.toUpperCase()} file downloaded successfully`, {
                autoClose: 1500,
                onClose: () => {
                    setTrackingState(prev => ({ ...prev, isDownloading: { ...prev.isDownloading, [fileType]: false } }));
                },
            });
        } catch (error) {
            const errorMessage = errorHandlers.handleCommonApiError(error, `Failed to download ${fileType.toUpperCase()} file.`);
            toast.error(errorMessage, {
                autoClose: 1500,
            });

        }
    }

    return (
        <div className="d-flex justify-content-end">
            {exportTypes.map(({ key, label }) => (
                <button
                    key={key}
                    className="btn btn-success me-2"
                    onClick={() => handleDownload(key)}
                    disabled={isDownloadingAny}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}

export default DownloadButtons