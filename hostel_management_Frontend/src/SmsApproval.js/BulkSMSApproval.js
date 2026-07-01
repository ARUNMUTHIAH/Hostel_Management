/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import SidebarDashboard from "../Sidebar/sidebar";
import axios from "axios";
import { API_URL } from "../API_URL";
import "./SmsApproval.css";

const BulkSMSApproval = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Default template
  const template =
    "Dear Parent, Your ward #field1# is not in the hostel (#field2#) on #field3# - TWOCQR";

  // Input fields for dynamic template
  const [field1, setField1] = useState(""); // Student Name
  const [field2, setField2] = useState(""); // Hostel
  const [field3, setField3] = useState(""); // Date/Time

  const token = sessionStorage.getItem("accessToken");

  /** Fetch students from backend */
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/smsconfiguration/bulksmsapproval`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { page, limit },
        }
      );

      if (res.data.status) {
        setStudents(res.data.data);
        setTotalPages(res.data.totalPages || 1);
      } else {
        toast.error("Failed to load students");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page]);

  /** Checkbox select single student */
  const handleCheckboxChange = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /** Select all students on current page */
  const handleSelectAll = (checked) => {
    setSelectedStudents(checked ? students.map((s) => s.student_id) : []);
  };

  /** Generate live template preview */
  const getLiveTemplate = () => {
    return template
      .replace(/#field1#/g, field1 || "___")
      .replace(/#field2#/g, field2 || "___")
      .replace(/#field3#/g, field3 || "___");
  };

  /** Send SMS to selected students */
  const handleSendSms = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student!");
      return;
    }
    if (!field1.trim() || !field2.trim() || !field3.trim()) {
      toast.error("Please fill all fields!");
      return;
    }

    // Prepare payload with the exact template text
    const body = selectedStudents.map((id) => ({
      student_id: id,
      message: getLiveTemplate(),
    }));

    try {
      const response = await axios.post(
        `${API_URL}/smsconfiguration/bulksmsapproval/send`,
        { students: body },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status) {
        toast.success(response.data.message);
        setSelectedStudents([]);
        setField1("");
        setField2("");
        setField3("");
        fetchStudents();
      } else {
        toast.error(response.data.message || "Failed to send SMS");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while sending SMS");
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
                  <i className="bi bi-chat-square-text-fill"></i>
                </div>
                <div>
                  <h1 className="hms-page-title">Bulk SMS Approval</h1>
                  <p className="hms-page-subtitle">Send bulk notifications to selected students</p>
                </div>
              </div>
            </div>
            <div className="hms-action-band">
              <div className="hms-action-band__left">
                <button
                  onClick={handleSendSms}
                  className="btn btn-add sms-send-btn"
                  disabled={
                    selectedStudents.length === 0 ||
                    !field1.trim() ||
                    !field2.trim() ||
                    !field3.trim()
                  }
                >
                  <i className="bi bi-send-fill me-1"></i>
                  Send SMS ({selectedStudents.length})
                </button>
              </div>
              <div className="hms-action-band__right">
                <div className="pagination-container">
                  <button
                    className={`pagination-btn ${page === 1 ? "disabled" : ""}`}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    ◀ Prev
                  </button>
                  <span className="pagination-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className={`pagination-btn ${page === totalPages ? "disabled" : ""}`}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
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
                            students.length > 0 &&
                            selectedStudents.length === students.length
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      )}
                    </th>
                    <th>S.No</th>
                    <th>Member ID</th>
                    <th>Name</th>
                    <th>Hostel</th>
                    <th>Last SMS Sent Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="100%" className="text-center p-3">
                        Loading...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="100%" className="text-center p-3">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => (
                      <tr key={student.student_id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.student_id)}
                            onChange={() =>
                              handleCheckboxChange(student.student_id)
                            }
                          />
                        </td>
                        <td>{index + 1 + (page - 1) * limit}</td>
                        <td>{student.memberid}</td>
                        <td>{student.name}</td>
                        <td>{student.hostel}</td>
                        <td>{student.last_sms_sent_at || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sms-template-card mt-3">
            <label className="sms-template-card__label">SMS Template Preview</label>
            <textarea
              className="sms-template-card__preview"
              value={getLiveTemplate()}
              readOnly
              rows={4}
            />
            <div className="sms-template-card__fields">
              <input
                type="text"
                className="form-control"
                value={field1}
                onChange={(e) => setField1(e.target.value)}
                placeholder="Field 1 (Student Name)"
              />
              <input
                type="text"
                className="form-control"
                value={field2}
                onChange={(e) => setField2(e.target.value)}
                placeholder="Field 2 (Hostel)"
              />
              <input
                type="text"
                className="form-control"
                value={field3}
                onChange={(e) => setField3(e.target.value)}
                placeholder="Field 3 26/12/2025,08:00pm"
              />
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

export default BulkSMSApproval;
