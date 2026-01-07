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
  const [smsContent, setSmsContent] = useState("");

  const token = sessionStorage.getItem("accessToken");

  /* Fetch all students for SMS (warden-mapped hostels) */
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

  /* Checkbox select single */
  const handleCheckboxChange = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /* Select all */
  const handleSelectAll = (checked) => {
    setSelectedStudents(checked ? students.map((s) => s.student_id) : []);
  };

  /* Replace placeholders in SMS content for each student */
  const getCustomizedMessage = (student) => {
    return smsContent
      .replace(/{name}/g, student.name)
      .replace(/{hostel}/g, student.hostel);
  };

  /* Send SMS to selected students */
  const handleSendSms = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student!");
      return;
    }
    if (!smsContent.trim()) {
      toast.error("Please enter the SMS message!");
      return;
    }

    try {
      // Prepare payload with student_id and customized messages
      const body = selectedStudents.map((id) => {
        const student = students.find((s) => s.student_id === id);
        return {
          student_id: id,
          message: getCustomizedMessage(student),
        };
      });

      const response = await axios.post(
        `${API_URL}/smsconfiguration/bulksmsapproval/send`,
        { students: body },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status) {
        toast.success(response.data.message);
        setSelectedStudents([]);
        setSmsContent("");
        fetchStudents();
      } else {
        toast.error(response.data.message || "Failed to send SMS");
        fetchStudents();
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while sending SMS");
    }
  };

  return (
    <div className="d-flex assetslocationmasterstable">
      <SidebarDashboard />
      <div className="main-content flex-grow-1" style={{ marginTop: "50px" }}>
        <h4 className="text-2xl font-bold text-black">Bulk SMS Approval</h4>

        {/* TABLE */}
        <div className="table-responsive mt-3">
          <table className="table table-striped">
            <thead style={{ background: "#1e40af", color: "white" }}>
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
                    <td>{student.sms_status || "Pending"}</td>
                    <td>{student.sms_sent_at || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CUSTOM SMS TEMPLATE */}
        <div className="sms-template mt-3">
          <label className="font-semibold mb-1">Custom SMS Message:</label>
          <textarea
            value={smsContent}
            onChange={(e) => setSmsContent(e.target.value)}
            placeholder="Type your SMS message here. Use {name}, {hostel} for dynamic values."
            rows={4}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              resize: "vertical",
            }}
          />
        </div>

        {/* BUTTON & PAGINATION */}
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            onClick={handleSendSms}
            className="btn"
            disabled={selectedStudents.length === 0 || !smsContent.trim()}
            style={{
              background: "linear-gradient(to right, #4f46e5, #7c3aed)",
              color: "white",
              fontWeight: "600",
              padding: "8px 24px",
              borderRadius: "6px",
              opacity:
                selectedStudents.length === 0 || !smsContent.trim() ? 0.6 : 1,
            }}
          >
            📩 Send SMS ({selectedStudents.length})
          </button>

          {/* PAGINATION */}
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

        <ToastContainer />
      </div>
    </div>
  );
};

export default BulkSMSApproval;
