import React from 'react'

const MasterHeader = ({ masterKey, assetMasters, handleSearchInput, onDeleteClick, masterChanges }) => {
  const pageName = sessionStorage.getItem("activeSidebarName") || masterKey;

  return (
    <div className="hms-page-shell">
      <div className="hms-page-band">
        <div className="hms-page-header__title-row">
          <div className="hms-page-header__icon">
            <i className="bi bi-database-fill-gear"></i>
          </div>
          <div>
            <h5 className="hms-page-title locationtopbar">{pageName}</h5>
            <p className="hms-page-subtitle">Manage records and configurations</p>
          </div>
        </div>
      </div>
      <div className="hms-action-band">
        <div className="hms-action-band__left">
          <button
            className="btn btn-add"
            data-bs-toggle="modal"
            data-bs-target="#addUserModal"
          >
            <i className="bi bi-plus-lg me-1"></i> Add New
          </button>
          <button
            className="btn btn-deletion"
            data-bs-toggle=""
            data-bs-target=""
            onClick={onDeleteClick}
            disabled={masterChanges.delete.toastActive}
          >
            <i className="bi bi-trash me-1"></i> Delete
          </button>
        </div>
        <div className="hms-action-band__right">
          <div className="hms-search-box searchboxmobileresponsive">
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="form-control"
              placeholder="Search records..."
              value={assetMasters.searchText}
              onChange={handleSearchInput}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MasterHeader
