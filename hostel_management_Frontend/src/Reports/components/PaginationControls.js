/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";

const PaginationControls = ({
  trackingState,
  setTrackingState,
  fetchTableData,
}) => {
  const start =
    (trackingState.pagination.page - 1) * trackingState.pagination.pageSize + 1;
  const end = Math.min(
    trackingState.pagination.page * trackingState.pagination.pageSize,
    trackingState.pagination.totalRecords
  );

  const handlePageChange = (type) => {
    const currentPage = trackingState.pagination.page;
    const newPage =
      type === "next"
        ? currentPage + 1
        : type === "prev"
        ? currentPage - 1
        : currentPage;
    const finalPage = newPage < 1 ? 1 : newPage;

    setTrackingState((prev) => ({
      ...prev,
      pagination: { ...prev.pagination, page: finalPage },
    }));
    fetchTableData(finalPage, trackingState.pagination.pageSize, false);
  };

  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <div>{`Showing ${start} - ${end} of ${
        trackingState.pagination.totalRecords
      } ${
        sessionStorage.getItem("activeSidebarName") || "Vehicle Management"
      }`}</div>
      <nav>
        <div className="pagination-boxlasttrackingasset">
          <ul className="pagination pagination-sm mb-0">
            {/* Only 5 page numbers at a time */}
            {(() => {
              const total = trackingState.pagination.totalPages;
              const current = trackingState.pagination.page;
              const pages = [];

              const addPage = (i) => {
                pages.push(
                  <li
                    key={i}
                    className={`page-item ${current === i ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (trackingState.pagination.page === i) return;
                      setTrackingState((prev) => ({
                        ...prev,
                        expandedRow: null,
                        pagination: { ...prev.pagination, page: i },
                      }));
                      fetchTableData(
                        i,
                        trackingState.pagination.pageSize,
                        false
                      );
                    }}
                  >
                    <a className="page-link">{i}</a>
                  </li>
                );
              };

              const addEllipsis = (key) => {
                pages.push(
                  <li key={key} className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                );
              };

              if (total <= 5) {
                for (let i = 1; i <= total; i++) addPage(i);
              } else {
                if (current <= 3) {
                  for (let i = 1; i <= 4; i++) addPage(i);
                  addEllipsis("end");
                  addPage(total);
                } else if (current >= total - 2) {
                  addPage(1);
                  addEllipsis("start");
                  for (let i = total - 3; i <= total; i++) addPage(i);
                } else {
                  addPage(1);
                  addEllipsis("start");
                  addPage(current - 1);
                  addPage(current);
                  addPage(current + 1);
                  addEllipsis("end");
                  addPage(total);
                }
              }

              return pages;
            })()}

            <li
              className={`page-item ${
                trackingState.pagination.page === 1 ? "disabled" : ""
              }`}
            >
              <a
                className="page-link"
                onClick={() => {
                  handlePageChange("prev");
                  setTrackingState((prev) => ({ ...prev, expandedRow: null }));
                }}
              >
                Previous
              </a>
            </li>

            <li
              className={`page-item ${
                trackingState.pagination.page ===
                trackingState.pagination.totalPages
                  ? "disabled"
                  : ""
              }`}
            >
              <a
                className="page-link"
                onClick={() => {
                  handlePageChange("next");
                  setTrackingState((prev) => ({ ...prev, expandedRow: null }));
                }}
              >
                Next
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default PaginationControls;
