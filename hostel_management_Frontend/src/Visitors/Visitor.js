import React, { useEffect, useState } from "react";
import SidebarDashboard from "../Sidebar/sidebar";
import { toast } from "react-toastify";
import TableSkeleton from "../TableSkeleton/TableSkeleton";
import { API_URL } from "../API_URL";
import AddVisitorModal from "./AddVisitorModal";

const Visitor = () => {
  const [visitorData, setVisitorData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchVisitors = async () => {
    setLoading(true);
    const token = sessionStorage.getItem("accessToken");
    try {
      const response = await fetch(`${API_URL}/visitor/visitorvehicle`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.status) {
        setVisitorData(result.data || []);
      } else {
        toast.error(result.message || "Failed to fetch visitor data");
      }
    } catch (err) {
      toast.error("Error fetching visitor data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  return (
    <div className="d-flex assetslocationmasterstable">
      <SidebarDashboard />
      <div className="main-content flex-grow-1" style={{ marginTop: "70px" }}>
        <div className="container-fluid mt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-primary mb-0">Visitor Vehicles</h6>
            <button
              className="btn btn-primary btn-sm"
              data-bs-toggle="modal"
              data-bs-target="#addVisitorModal"
            >
              <i className="bi bi-plus-circle me-1"></i> Add Visitor Entry
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-bordered table-sm">
              <thead className="table-light">
                <tr>
                  <th>S.No</th>
                  <th>Visitor Name</th>
                  <th>Vehicle No</th>
                  <th>Mobile</th>
                  <th>Purpose</th>
                  <th>Location</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={9} />
                ) : visitorData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center">
                      No visitor entries found
                    </td>
                  </tr>
                ) : (
                  visitorData.map((v, index) => (
                    <tr key={v.id}>
                      <td>{index + 1}</td>
                      <td>{v.visitor_name}</td>
                      <td>{v.vehicle_number}</td>
                      <td>{v.mobile}</td>
                      <td>{v.purpose}</td>
                      <td>{v.location_name}</td>
                      <td>{v.check_in || "-"}</td>
                      <td>{v.check_out || "-"}</td>
                      <td>
                        <span
                          className={`badge ${
                            v.status === "In" ? "bg-success" : "bg-secondary"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ✅ Add Visitor Modal */}
      <AddVisitorModal onSuccess={fetchVisitors} />
    </div>
  );
};

export default Visitor;
