import React from "react";

const Header = ({ onToggleSidebar, isMobile }) => {
  const username = JSON.parse(sessionStorage.getItem("Username"));

  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <header className="custom-header d-flex align-items-center justify-content-between px-3">
      {/* LEFT: Mobile toggle button */}
      <div className="d-md-none">
        <button
          id="toggle-sidebar"
          className="btn toggle-btn border-0"
          onClick={onToggleSidebar}
        >
          <i className="bi bi-list fs-3 mobiletoggle-icon"></i>
        </button>
      </div>

      {/* LEFT: Logo */}
      <div className="d-flex align-items-center">
        <img src="../2cqr-512.png" alt="SRM Logo" className="header-logo-img" />
      </div>

      {/* CENTER: Title - only on desktop */}
      <div className="d-none d-md-block position-absolute start-50 translate-middle-x">
        <span className="header-title">Vehicle Management</span>
      </div>

      {/* RIGHT: Profile */}
      <div className="profile-icon d-flex justify-content-center flex-column align-items-center">
        <img
          src="../images/headerprofileimgsrm.png"
          alt="Profile"
          className="rounded-circle"
          style={{ width: "30px", height: "30px", objectFit: "cover" }}
          title={displayName}
        />
        <div style={{ fontSize: "15px" }} className="text-black">
          {" "}
          {displayName.length > 10
            ? `${displayName.slice(0, 10)}...`
            : displayName}{" "}
        </div>
      </div>
    </header>
  );
};

export default Header;
