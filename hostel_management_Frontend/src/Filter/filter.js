/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import "./filter.css";

const ReportsPage = () => {
  return (
    <div className="container py-4">
      <h5>Reports</h5>

      <div className="row g-4 align-items-stretch">
        {/* Left Section */}
        <div className="col-lg-8">
          <div className="card-custom cardfilters">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h6 className="mb-0">Select filters for data</h6>
              <a className="text-primary text-decoration-none">Clear</a>
            </div>

            <div className="row g-3">
              {/* Row 1 */}
              <div className="col-md-4">
                <label className="form-label fw-bold">Vehicle Type</label>
                <select className="form-select">
                  <option>Select Vehicle Type</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Category</label>
                <select className="form-select">
                  <option>Select Category</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Sub Category</label>
                <select className="form-select">
                  <option>Select Sub Category</option>
                </select>
              </div>

              {/* Row 2 */}
              <div className="col-md-4">
                <label className="form-label fw-bold">Location 1</label>
                <select className="form-select">
                  <option>Select Location 1</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Location 3</label>
                <select className="form-select">
                  <option>Select Location 3</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Location 2</label>
                <select className="form-select">
                  <option>Select Location 2</option>
                </select>
              </div>

              {/* Row 3 */}
              <div className="col-md-4">
                <label className="form-label fw-bold">Quantity</label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    placeholder=""
                  />
                  <button className="btn btn-outline-secondary" type="button">
                    +
                  </button>
                  <button className="btn btn-outline-secondary" type="button">
                    -
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Vendor</label>
                <select className="form-select">
                  <option>Select Vendor</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Brand</label>
                <select className="form-select">
                  <option>Select Brand</option>
                </select>
              </div>

              {/* Row 4 */}
              <div className="col-md-4">
                <label className="form-label fw-bold">AMC Status</label>
                <select className="form-select">
                  <option>Select AMC Status</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Year of Purchase</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Select Year"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold">Status</label>
                <select className="form-select">
                  <option>Select Status</option>
                </select>
              </div>

              {/* Row 5 Buttons */}
              <div
                className="row mt-3"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <div className="col-3">
                  <button
                    className="btn w-100 py-2 fw-bold"
                    style={{
                      backgroundColor: "#DADADA",
                      border: "1px solid #e0e0e0",
                      color: "#000",
                    }}
                  >
                    Set
                  </button>
                </div>

                <div className="col-3">
                  <button className="btn btn-primary w-100 py-2 fw-bold">
                    Start Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="col-lg-4">
          <div className="card-custom p-4 cardfilters">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Scan Results</h6>
              <button
                className="btn btn-sm"
                style={{
                  backgroundColor: "#e0f0ff",
                  color: "#0d6efd",
                  fontWeight: 600,
                  borderRadius: "8px",
                  width: "100px",
                }}
              >
                Start
              </button>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 fw-bold">Expected Result :</h5>
              <div className="d-flex">
                <button className="btn btn-sm play-btn p-1">
                  <img
                    src="images/playbtnfilterspage.png"
                    alt="Play"
                    style={{ width: "24px", height: "24px" }}
                  />
                </button>
                <button className="btn btn-sm pause-btn p-1 ms-2">
                  <img
                    src="images/pausebtnfilterspage.png"
                    alt="Pause"
                    style={{ width: "24px", height: "24px" }}
                  />
                </button>
              </div>
            </div>

            <div className="circle-scan mb-4 mx-auto circlescanfilter">
              <div className="text-center">
                <h2 className="mb-0">00</h2>
                <small className="fw-bold">Asset Scanning</small>
              </div>
            </div>

            <div className="row text-center mt-4 g-3">
              <div className="col-4">
                <div className="result-box matched">
                  <h5 className="mb-1">0</h5>
                  <small>Matched</small>
                </div>
              </div>
              <div className="col-4">
                <div className="result-box missing">
                  <h5 className="mb-1">0</h5>
                  <small>Missing</small>
                </div>
              </div>
              <div className="col-4">
                <div className="result-box unexpected">
                  <h5 className="mb-1">0</h5>
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

export default ReportsPage;
