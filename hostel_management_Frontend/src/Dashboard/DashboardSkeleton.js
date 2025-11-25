// DashboardSkeleton.js
import React from "react";

const skeletonStyle = {
  backgroundColor: "#e0e0e0",
  borderRadius: "6px",
  animation: "pulse 1.5s infinite ease-in-out",
};

const SkeletonBox = ({ height, width }) => (
  <div style={{ ...skeletonStyle, height, width }}></div>
);

const DashboardSkeleton = () => {
  return (
    <div className="container py-4">
      {/* Top Row */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <SkeletonBox height="100px" width="100%" />
        </div>
        <div className="col-md-8">
          <div style={{ ...skeletonStyle, padding: "10px" }}>
            <SkeletonBox height="20px" width="40%" />
            <SkeletonBox height="180px" width="100%" style={{ marginTop: "10px" }} />
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="row g-3">
        <div className="col-md-6">
          <div style={{ ...skeletonStyle, padding: "10px" }}>
            <SkeletonBox height="20px" width="60%" />
            <SkeletonBox height="160px" width="100%" style={{ marginTop: "10px" }} />
          </div>
        </div>
        <div className="col-md-6">
          <div style={{ ...skeletonStyle, padding: "10px" }}>
            <SkeletonBox height="20px" width="50%" />
            <SkeletonBox height="160px" width="100%" style={{ marginTop: "10px" }} />
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="row g-3 mt-1">
        <div className="col-md-12">
          <div style={{ ...skeletonStyle, padding: "10px" }}>
            <SkeletonBox height="20px" width="50%" />
            <SkeletonBox height="180px" width="100%" style={{ marginTop: "10px" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add a simple keyframes animation globally
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}`, styleSheet.cssRules.length);

export default DashboardSkeleton;
