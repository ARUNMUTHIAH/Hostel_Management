import React from "react";

const Header = ({ onToggleSidebar, isMobile }) => {
  const username = JSON.parse(sessionStorage.getItem("Username")) || "User";
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <header className="custom-header d-flex align-items-center justify-content-between">
      <div className="d-flex align-items-center gap-3">
        <div className="d-md-none">
          <button
            id="toggle-sidebar"
            className="btn toggle-btn"
            onClick={onToggleSidebar}
          >
            <i className="bi bi-list fs-5 mobiletoggle-icon"></i>
          </button>
        </div>
        <div className="header-brand-mark d-none d-md-flex">
          <i className="bi bi-building"></i>
        </div>
      </div>

      <div className="flex-grow-1 text-center px-2">
        <span className="header-title text-truncate d-inline-block" style={{ maxWidth: "100%" }}>
          Hostel Management Software
        </span>
      </div>

      <div className="profile-icon">
        <img
          src="../images/headerprofileimgsrm.png"
          alt="Profile"
          className="rounded-circle"
          title={displayName}
        />
        <span className="profile-name">{displayName}</span>
      </div>
    </header>
  );
};

export default Header;
