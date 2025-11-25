/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../API_URL";
import { toast } from "react-toastify";
import errorHandlers, { handleTokenExpired } from "../utils/errorHandlers";

const LastVehicleTrackingTable = () => {
  const [trackingData, setTrackingData] = useState([]);

  useEffect(() => {
    fetchLastVehicleTracking();
  }, []);

  const formatDate = (date) => date.toISOString().split("T")[0];

  const fetchLastVehicleTracking = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const toDate = formatDate(new Date());
      const fromDate = formatDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      // ✅ Query params for URL
      const params = new URLSearchParams({
        fromDate,
        toDate,
        vehiclenumber: "",
        vehiclerfid: "",
        location: "",
        place: "",
        gate: "",
        status: "",
        movement_type: "",
        pagesize: 0, // ✅ 0 = fetch all (backend already handles this)
        page: 1,
      }).toString();

      // ✅ Correct API call (POST + query string)
      const response = await axios.post(
        `${API_URL}/report/lastvehicletracking?${params}`,
        {}, // empty body
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200 && response.data?.status) {
        setTrackingData(response.data.data || []);
      } else {
        console.error("Unexpected response:", response);
        setTrackingData([]);
      }
    } catch (error) {
      console.error("Error fetching last vehicle tracking data:", error);
      if (error.response?.status === 401) {
        handleTokenExpired();
        return;
      }
      const msg = errorHandlers.handleCommonApiError(
        error,
        "Failed to fetch last vehicle tracking data."
      );
      toast.error(msg, { autoClose: 1000 });
      setTrackingData([]);
    }
  };

  return (
    <div className="dashboardchart-card">
      <h6>Last 7 Days Vehicle Tracking Entries</h6>
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle mb-5">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Vehicle Number</th>
              <th>RFID</th>
              <th>Location</th>
              <th>Gate</th>
              <th>Status</th>
              <th>Transaction Time</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {trackingData.length > 0 ? (
              trackingData.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.vehiclenumber}</td>
                  <td>{item.vehiclerfid}</td>
                  <td>{item.location}</td>
                  <td>{item.location1}</td>
                  <td>
                    <span
                      className={`badge ${
                        item.status === "IN" ? "bg-success" : "bg-danger"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.transtime}</td>
                  <td>{item.remarks || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LastVehicleTrackingTable;
