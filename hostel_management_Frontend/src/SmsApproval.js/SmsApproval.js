import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import SidebarDashboard from "../Sidebar/sidebar";
import axios from "axios";
import { API_URL } from "../API_URL";

const SmsApproval = () => {
  const [lateStudents, setLateStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
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
      });
      if (res.data.status) {
        setLateStudents(res.data.data);
      } else {
        toast.error("Failed to load data");
      }
    } catch (error) {
      toast.error("Server Error");
    } finally {
      setLoading(false);
    }
  };

  /* First Load */
  useEffect(() => {
    fetchLateStudents();
  }, []);

  /* Checkbox select single */
  const handleCheckboxChange = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /* Select all */
  const handleSelectAll = (checked) => {
    setSelectedStudents(
      checked ? lateStudents.map((s) => s.student_movement_id) : []
    );
  };

  /* Send SMS */
  const handleSendSms = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student!");
      return;
    }

    try {
      const body = {
        student_ids: selectedStudents, // send selected students id
      };

      const response = await axios.post(
        `${API_URL}/smsconfiguration/sendLateReturnSms`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.status) {
        toast.success(response.data.message || "SMS Sent Successfully");
        setSelectedStudents([]);
      } else {
        toast.error(response.data.message || "SMS Failed");
      }
    } catch (error) {
      toast.error("Something went wrong while sending SMS");
      console.error(error);
    }
  };

  return (
    <div className="d-flex assetslocationmasterstable">
      <SidebarDashboard />

      <div className="main-content flex-grow-1" style={{ marginTop: "50px" }}>
        {/* HEADING */}
        <h4 className="text-2xl font-bold text-black">
          Late Return SMS Approval
        </h4>

        {/* TABLE */}
        <div className="table-responsive mt-3">
          <table className="table table-striped">
            <thead style={{ background: "#1e40af", color: "white" }}>
              <tr>
                <th style={{ width: "5%" }}>
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
                <th style={{ width: "8%" }}>S.No</th>
                <th style={{ width: "18%" }}>Member ID</th>
                <th style={{ width: "25%" }}>Name</th>
                <th style={{ width: "22%" }}>Hostel</th>
                <th style={{ width: "22%" }}>Out Time</th>
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
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>{student.memberid}</td>
                    <td>{student.name}</td>
                    <td>{student.hostel}</td>
                    <td>{student.out_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BUTTON */}
        <div className="mt-3 text-end">
          <button
            onClick={handleSendSms}
            className="btn"
            disabled={selectedStudents.length === 0}
            style={{
              background: "linear-gradient(to right, #4f46e5, #7c3aed)",
              color: "white",
              fontWeight: "600",
              padding: "8px 24px",
              borderRadius: "6px",
              opacity: selectedStudents.length === 0 ? 0.6 : 1,
            }}
          >
            📩 Send SMS ({selectedStudents.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmsApproval;
