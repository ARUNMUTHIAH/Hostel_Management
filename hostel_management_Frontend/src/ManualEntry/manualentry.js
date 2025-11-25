import React from "react";
import "./manualentry.css";

const ManualEntry = () => {
  return (
    <div className="container py-4">
      <h6 className="fw-bold mb-3">Manual Entry</h6>

      <div className="row g-4 align-items-stretch">
        {/* Left Section */}
        <div className="col-lg-8">
          <div className="card p-4 h-100">
            <label className="mb-2 fw-semibold">Enter Vehicle Number</label>
            <div className="row g-2 align-items-center mb-4">
              <div className="col">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Vehicle Number"
                />
              </div>
              <div className="col-auto">
                <button className="btn btn-primary px-3">
                  <i className="bi bi-plus-lg"></i>
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-center gap-2">
              <button
                className="btn btn-sm px-4"
                style={{ backgroundColor: "#DADADA", color: "black" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm px-4"
                style={{ backgroundColor: "#009FF7", color: "white" }}
              >
                Start Scan
              </button>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="col-lg-4">
          <div className="card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold">Scan Results</span>
              <span className="badge bg-light border text-primary px-3 py-1">
                Start
              </span>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold">Expected Result :</span>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-sm"
                  style={{ backgroundColor: "#007bff", color: "white" }}
                >
                  <i className="bi bi-play-fill"></i>
                </button>
                <button
                  className="btn btn-sm"
                  style={{ backgroundColor: "#6f42c1", color: "white" }}
                >
                  <i className="bi bi-pause-fill"></i>
                </button>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-center mt-3">
              <div className="manualentryscanner-circle text-center">
                <h4 className="mb-0">00</h4>
                <small className="text-muted">Asset Scanning</small>
              </div>
            </div>

            <div className="row text-center mt-4">
              <div className="col">
                <div className="bg-success bg-opacity-10 p-2 rounded">
                  <div className="fw-bold">0</div>
                  <small>Matched</small>
                </div>
              </div>
              <div className="col">
                <div className="bg-danger bg-opacity-10 p-2 rounded">
                  <div className="fw-bold">0</div>
                  <small>Missing</small>
                </div>
              </div>
              <div className="col">
                <div className="bg-warning bg-opacity-10 p-2 rounded">
                  <div className="fw-bold">0</div>
                  <small>Unexpected</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualEntry;
