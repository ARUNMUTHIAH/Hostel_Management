/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import * as BsIcons from "react-icons/bs";
import { Collapse } from "react-bootstrap";
import Header from "../Header/header";
import "./sidebar.css";

const SidebarDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeId, setActiveId] = useState(null);
  const [sidebarList, setSidebarList] = useState([]);
  const [activeMenus, setActiveMenus] = useState([]);

  // Get icon
  const getIcon = (iconName) => BsIcons[iconName] || BsIcons.BsCircle;

  // Load sidebar from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sidebar");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSidebarList(parsed);

        // Initialize activeMenus from children with status = true
        const matched = parsed.find((menu) =>
          menu.children?.some((child) => child.status === true)
        );
        if (matched) {
          setActiveMenus([matched.name]);
        }
      }
    } catch (e) {
      console.error("Invalid sidebar in sessionStorage");
    }
  }, []);

  const toggleDropdown = (menuName) => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar.classList.contains("collapsed")) {
      sidebar.classList.remove("collapsed");
      setIsSidebarCollapsed(false);
    }
    const navLabels = document.querySelectorAll(".nav-item span");
    const dropdownIcons = document.querySelectorAll(".dropdown-icon");
    navLabels.forEach((label) => (label.style.display = "inline-block"));
    dropdownIcons.forEach((icon) => (icon.style.display = "inline-block"));
    setActiveMenus((prev) => (prev.includes(menuName) ? [] : [menuName]));
  };

  const capitalizeWords = (str) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const renderMenu = (items) =>
    items.map((item) => {
      const Icon = getIcon(item.icon || "BsCircle");
      const hasChildren =
        Array.isArray(item.children) && item.children.length > 0;
      const isOpen = activeMenus.includes(item.name);

      return (
        <li key={item.id} className="nav-item mb-2">
          {hasChildren ? (
            <>
              <div
                className="nav-link d-flex align-items-center sidebar-item manage-link"
                onClick={() => toggleDropdown(item.name)}
                role="button"
              >
                <Icon className="me-2" size={18} />
                <span className="link-text">{item.name}</span>
                {!isSidebarCollapsed && (
                  <i
                    className={`bi bi-chevron-${
                      isOpen ? "up" : "down"
                    } dropdown-icon ms-auto`}
                  ></i>
                )}
              </div>
              <Collapse in={isOpen}>
                <ul className="submenu-options list-unstyled mt-2 px-3">
                  {renderMenu(item.children)}
                </ul>
              </Collapse>
            </>
          ) : (
            <NavLink
              to={item.path}
              key={item.id}
              onClick={() => {
                setActiveId(item.id);
                sessionStorage.setItem(
                  "activeSidebarName",
                  capitalizeWords(item.name)
                );

                const updateStatus = (items) =>
                  items.map((ele) => {
                    if (ele?.children?.length > 0) {
                      ele.children = updateStatus(ele.children);
                    }
                    return { ...ele, status: ele.id === item.id };
                  });

                const updatedSidebar = updateStatus(sidebarList);
                setSidebarList(updatedSidebar);
                sessionStorage.setItem(
                  "sidebar",
                  JSON.stringify(updatedSidebar)
                );
              }}
              className={() =>
                `nav-link d-flex align-items-center sidebar-item ${
                  item.status ? "active" : ""
                }`
              }
            >
              <Icon className="me-2" size={18} />
              <span className="link-text">{capitalizeWords(item.name)}</span>
            </NavLink>
          )}
        </li>
      );
    });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const sidebar = document.getElementById("sidebar");
      const isCollapsing = !prev;

      sidebar.classList.toggle("collapsed", isCollapsing);

      const navLabels = document.querySelectorAll(".nav-item span");
      const dropdownIcons = document.querySelectorAll(".dropdown-icon");

      navLabels.forEach((label) => {
        label.style.display = isCollapsing ? "none" : "inline-block";
      });
      dropdownIcons.forEach((icon) => {
        icon.style.display = isCollapsing ? "none" : "inline-block";
      });

      if (isCollapsing) {
        setActiveMenus([]);
      }

      return isCollapsing;
    });
  };

  useEffect(() => {
    const adjustMainContent = () => {
      const mainContent = document.querySelector(".main-content");
      // eslint-disable-next-line no-unused-vars
      const sidebar = document.getElementById("sidebar");
      if (window.innerWidth > 767) {
        setIsMobile(false);
        // mainContent.style.marginLeft = sidebar.classList.contains("collapsed");
      } else {
        setIsMobile(true);
        mainContent.style.marginTop = "56px";
        mainContent.style.marginLeft = "0";
      }
    };

    const handleClickOutside = (event) => {
      const sidebar = document.getElementById("sidebar");
      const toggleSidebarBtn = document.getElementById("toggle-sidebar");

      if (
        sidebar.classList.contains("expanded") &&
        !sidebar.contains(event.target) &&
        !toggleSidebarBtn.contains(event.target)
      ) {
        sidebar.classList.remove("expanded");
        document.body.classList.remove("sidebar-open");
      }
    };

    window.addEventListener("resize", adjustMainContent);
    document.addEventListener("click", handleClickOutside);
    adjustMainContent();

    // document.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("resize", adjustMainContent);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isSidebarCollapsed]);

  return (
    <div className="d-flex">
      <Header onToggleSidebar={toggleSidebar} isMobile={isMobile} />
      <div
        id="sidebar"
        className={`sidebar d-flex flex-column align-items-center py-4 
          ${isSidebarCollapsed ? "collapsed" : ""} 
          ${isMobile ? (sidebarOpen ? "open" : "closed") : ""}`}
      >
        <div
          className="sidebar-header d-flex align-items-center"
          style={{
            height: "50px",
            padding: isSidebarCollapsed ? "0" : "0 8px",
            flexWrap: "nowrap",
            justifyContent: isSidebarCollapsed ? "center" : "flex-start",
          }}
        >
          {/* LEFT – Logo OR Burger */}
          <div
            style={{
              width: 40,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: isSidebarCollapsed ? "translateX(20px)" : "none",
            }}
          >
            {isSidebarCollapsed ? (
              // 👉 Burger when collapsed
              <button
                onClick={toggleSidebar}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <i
                  className="bi bi-list"
                  style={{ fontSize: 24, color: "#fff" }}
                />
              </button>
            ) : (
              // 👉 Logo when expanded
              <img
                src="../2cqr-512.png"
                alt="Logo"
                style={{ height: 30, width: "100%" }}
              />
            )}
          </div>

          {/* TITLE */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              padding: "0 6px",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "white",
                display: isSidebarCollapsed ? "none" : "block",
              }}
            >
              HOSTEL MANAGEMENT
            </span>
          </div>

          {/* RIGHT – Burger (only when expanded) */}
          {!isSidebarCollapsed && (
            <div
              style={{
                width: 40,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <button
                onClick={toggleSidebar}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <i
                  className="bi bi-list"
                  style={{ fontSize: 24, color: "#fff" }}
                />
              </button>
            </div>
          )}
        </div>

        <ul className="nav flex-column text-start w-100 px-3">
          {renderMenu(sidebarList)}
          <li className="nav-item mb-2">
            <a
              href="#"
              className="nav-link d-flex align-items-center sidebar-item"
              onClick={(e) => {
                e.preventDefault();
                sessionStorage.clear();
                navigate("/", { replace: true });
              }}
            >
              <BsIcons.BsBoxArrowRight className="me-2" size={18} />
              <span className="link-text">Logout</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SidebarDashboard;
