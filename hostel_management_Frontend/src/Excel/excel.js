import React from "react";
import "./excel.css";

const ExcelUpload = () => {
  return (
    <div className="container py-4">
      <h6 className="fw-bold mb-3">Excel</h6>

      <div className="row g-4 align-items-stretch">
        {/* Left Upload Section */}
        <div className="col-lg-8">
          <div className="card p-4 h-100">
            <div className="d-flex justify-content-end mb-3">
              <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1">
                Format <i className="bi bi-download"></i>
              </button>
            </div>

            <div className="excelborder-dashed p-4 text-center excelbg-light-blue">
              <h6 className="fw-semibold">
                Drag your files to start uploading
              </h6>
              <p className="text-muted small mb-2">
                Max 10mb files are allowed
              </p>
              <p className="text-muted small">Or</p>
              <button className="btn btn-primary btn-sm">Browse Files</button>
            </div>

            <div className="d-flex justify-content-center flex-wrap mt-4 gap-2">
              <button
                className="btn btn-sm px-4"
                style={{ backgroundColor: "#DADADA", color: "black" }}
              >
                Set
              </button>
              <button
                className="btn btn-sm px-4"
                style={{
                  backgroundColor: "linear-gradient(90deg, #005F9E, #1E90FF)",
                  color: "white",
                }}
              >
                Start Scan
              </button>
            </div>
          </div>
        </div>

        {/* Right Scan Results Section */}
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
              <div className="excelscanner-circle text-center">
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

export default ExcelUpload;
