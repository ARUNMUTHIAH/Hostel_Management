import React from 'react'

const MasterHeader = ({ masterKey, assetMasters, handleSearchInput, onDeleteClick, masterChanges }) => {
  return (
    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
      <div>
        <h5 className="mb-2 locationtopbar">
          {sessionStorage.getItem("activeSidebarName") || masterKey}
        </h5>
        <button
          className="btn btn-add"
          data-bs-toggle="modal"
          data-bs-target="#addUserModal"
        >
          Add New +
        </button>
        <button
          className="btn btn-deletion ms-2"
          data-bs-toggle=""
          data-bs-target=""
          onClick={onDeleteClick}
          disabled={masterChanges.delete.toastActive}
        >
          Delete
        </button>
      </div>
      <div>
        <div className="search-box position-relative searchboxmobileresponsive" style={{ top: "16px" }}>
          <i
            className="bi bi-search search-icon position-absolute"
            style={{ top: "50%", left: "10px", transform: "translateY(-50%)" }}
          ></i>
          <input
            type="text"
            className="form-control ps-5"
            placeholder="Search"
            style={{ height: "40px", fontSize: "13px" }}
            value={assetMasters.searchText}
            onChange={handleSearchInput}
          />
        </div>
      </div>
    </div>
  )
}

export default MasterHeader