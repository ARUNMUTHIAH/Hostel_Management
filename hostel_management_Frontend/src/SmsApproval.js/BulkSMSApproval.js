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
    <div className="d-flex assetslocationmasterstable">
      <SidebarDashboard />
      <div className="main-content flex-grow-1" style={{ marginTop: "50px" }}>
        <h4 className="text-2xl font-bold text-black">Bulk SMS Approval</h4>

        {/* Students Table */}
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
          {/* Pagination */}
          {
            <div
              className="d-flex justify-content-end align-items-center mt-3 gap-2"
              style={{ paddingRight: "10px" }} // optional spacing from right edge
            >
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          }
        </div>

        {/* SMS Template Preview */}
        <div className="sms-template mt-3">
          <label className="font-semibold mb-1">SMS Template Preview:</label>
          <textarea
            value={getLiveTemplate()}
            readOnly
            rows={4}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              resize: "vertical",
              backgroundColor: "#f0f0f0",
            }}
          />

          {/* Input Fields */}
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <input
              type="text"
              value={field1}
              onChange={(e) => setField1(e.target.value)}
              placeholder="Field 1 (Student Name)"
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
            <input
              type="text"
              value={field2}
              onChange={(e) => setField2(e.target.value)}
              placeholder="Field 2 (Hostel)"
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
            <input
              type="text"
              value={field3}
              onChange={(e) => setField3(e.target.value)}
              placeholder="Field 3 26/12/2025,08:00pm"
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>

        {/* Send Button */}
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            onClick={handleSendSms}
            className="btn"
            disabled={
              selectedStudents.length === 0 ||
              !field1.trim() ||
              !field2.trim() ||
              !field3.trim()
            }
            style={{
              background: "linear-gradient(to right, #4f46e5, #7c3aed)",
              color: "white",
              fontWeight: "600",
              padding: "8px 24px",
              borderRadius: "6px",
              opacity:
                selectedStudents.length === 0 ||
                !field1.trim() ||
                !field2.trim() ||
                !field3.trim()
                  ? 0.6
                  : 1,
            }}
          >
            📩 Send SMS ({selectedStudents.length})
          </button>
        </div>

        <ToastContainer />
      </div>
    </div>
  );
};

export default BulkSMSApproval;
