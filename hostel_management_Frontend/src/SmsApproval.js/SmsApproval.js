/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import SidebarDashboard from "../Sidebar/sidebar";
import axios from "axios";
import { API_URL } from "../API_URL";
import "./SmsApproval.css";

const SmsApproval = () => {
  const [lateStudents, setLateStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10); // rows per page

  const token = sessionStorage.getItem("accessToken");

  /* Fetch Late Students from Backend */
  const fetchLateStudents = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/smsconfiguration/smsapproval`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: { page, limit }, // ✅ send pagination params
      });

      if (res.data.status) {
        setLateStudents(res.data.data);
        setTotalPages(res.data.totalPages || 1); // ✅ set totalPages
      } else {
        toast.error("Failed to load data");
      }
    } catch (error) {
      toast.error("Server Error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /* First Load & whenever page changes */
  useEffect(() => {
    fetchLateStudents();
  }, [page]);

  /* Checkbox select single */
  const handleCheckboxChange = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /* Select all */
  const handleSelectAll = (checked) => {
    setSelectedStudents(
      checked
        ? lateStudents
            .filter((s) => s.sms_status !== "sent") // only pending
            .map((s) => s.student_movement_id)
        : []
    );
  };

  /* Send SMS */
  const handleSendSms = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student!");
      return;
    }

    try {
      const body = { student_ids: selectedStudents };
      const response = await axios.post(
        `${API_URL}/smsconfiguration/sendLateReturnSms`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status) {
        toast.success(response.data.message);
        setSelectedStudents([]);
        fetchLateStudents(); // refresh list
      } else {
        toast.error(response.data.message);
        fetchLateStudents(); // refresh list
      }
    } catch (error) {
      toast.error("Something went wrong while sending SMS");
      console.error(error);
    }
  };

  return (
    <div className="d-flex assetslocationmasterstable hms-app-shell">
      <SidebarDashboard />

      <div className="main-content flex-grow-1">
        <div className="container py-3 hms-page location-page">
          <div className="hms-page-shell">
            <div className="hms-page-band">
              <div className="hms-page-header__title-row">
                <div className="hms-page-header__icon">
                  <i className="bi bi-chat-dots-fill"></i>
                </div>
                <div>
                  <h1 className="hms-page-title">Late Return SMS Approval</h1>
                  <p className="hms-page-subtitle">Review and send late return notifications</p>
                </div>
              </div>
            </div>
            <div className="hms-action-band">
              <div className="hms-action-band__left">
                <button
                  onClick={handleSendSms}
                  className="btn btn-add sms-send-btn"
                  disabled={selectedStudents.length === 0}
                >
                  <i className="bi bi-send-fill me-1"></i>
                  Send SMS ({selectedStudents.length})
                </button>
              </div>
              <div className="hms-action-band__right">
                <div className="pagination-container">
                  <button
                    className={`pagination-btn ${page === 1 ? "disabled" : ""}`}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  >
                    ◀ Prev
                  </button>
                  <span className="pagination-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className={`pagination-btn ${
                      page === totalPages ? "disabled" : ""
                    }`}
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="table-container mt-3">
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>
                      {!loading && (
                        <input
                          type="checkbox"
                          checked={
                            lateStudents.length > 0 &&
                            selectedStudents.length === lateStudents.length
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      )}
                    </th>
                    <th>S.No</th>
                    <th>Member ID</th>
                    <th>Name</th>
                    <th>Hostel</th>
                    <th>SMS Alert Type</th>
                    <th>Out Time</th>
                    <th>Status</th>
                    <th>SMS Sent Time</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="100%" className="text-center p-3">
                        Loading...
                      </td>
                    </tr>
                  ) : lateStudents.length === 0 ? (
                    <tr>
                      <td colSpan="100%" className="text-center p-3">
                        No late students found
                      </td>
                    </tr>
                  ) : (
                    lateStudents.map((student, index) => (
                      <tr key={student.student_movement_id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(
                              student.student_movement_id
                            )}
                            onChange={() =>
                              handleCheckboxChange(student.student_movement_id)
                            }
                            disabled={student.sms_status === "sent"}
                          />
                        </td>
                        <td>{index + 1 + (page - 1) * limit}</td>
                        <td>{student.memberid}</td>
                        <td>{student.name}</td>
                        <td>{student.hostel}</td>
                        <td>{student.sms_alert_type}</td>
                        <td>{student.out_time}</td>
                        <td>{student?.sms_status || "Pending"}</td>
                        <td>{student?.sms_sent_at || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className="hms-app-footer">
            <img src="images/2cqrfooterlogo.png" alt="2cqr logo" />
            <span>2cqr &copy; 2025</span>
          </footer>
        </div>

        <ToastContainer />
      </div>
    </div>
  );
};

export default SmsApproval;
