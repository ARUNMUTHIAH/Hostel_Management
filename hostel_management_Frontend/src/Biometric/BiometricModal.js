// import React, { useState } from "react";
// import { toast } from "react-toastify";

// const BiometricModal = ({ show, onClose, studentId, studentName }) => {
//   const [loading, setLoading] = useState(false);

//   if (!show) return null;

//   const handleEnroll = async () => {
//     setLoading(true);
//     try {
//       const response = await fetch(
//         `${process.env.REACT_APP_API_URL}/student/${studentId}/enroll-fingerprint`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${localStorage.getItem("token")}`,
//           },
//         }
//       );

//       const data = await response.json();
//       setLoading(false);

//       if (data.status) {
//         toast.success("Fingerprint enrollment started — check scanner window");
//         onClose();
//       } else {
//         toast.error(data.message || "Error starting enrollment");
//       }
//     } catch (err) {
//       console.error(err);
//       toast.error("Bridge is offline — start biometric EXE application");
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="modal-overlay">
//       <div className="modal-box">
//         <h5>Enroll Fingerprint</h5>
//         <p>
//           <strong>Student:</strong> {studentName}
//         </p>

//         <button
//           className="btn btn-primary"
//           onClick={handleEnroll}
//           disabled={loading}
//         >
//           {loading ? "Initializing..." : "Start Enrollment"}
//         </button>

//         <button className="btn btn-secondary ms-2" onClick={onClose}>
//           Close
//         </button>
//       </div>
//     </div>
//   );
// };

// export default BiometricModal;

//before error and success message format

import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";

const BiometricModal = ({ show, onClose, studentId, studentName }) => {
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleEnroll = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/student/${studentId}/enroll-fingerprint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await response.json();
      setLoading(false);

      // Show backend message exactly as it is
      if (data.status) {
        toast.success(data.message || "Fingerprint enrollment started.");
        onClose();
      } else {
        toast.error(data.message || "Failed to start enrollment.");
      }
    } catch (err) {
      setLoading(false);

      // Handle network errors (fetch failed)
      console.error("Enrollment Error:", err);

      toast.error(
        err?.message || "Bridge is offline — start biometric EXE application"
      );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h5>Enroll Fingerprint</h5>
        <p>
          <strong>Student:</strong> {studentName}
        </p>

        <button
          className="btn btn-primary"
          onClick={handleEnroll}
          disabled={loading}
        >
          {loading ? "Initializing..." : "Start Enrollment"}
        </button>

        <button className="btn btn-secondary ms-2" onClick={onClose}>
          Close
        </button>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default BiometricModal;
