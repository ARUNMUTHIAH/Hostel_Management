/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import TableSkeleton from "../../TableSkeleton/TableSkeleton";
import Pagination from "../../Masters/components/Pagination";

const StudentTable = ({
  assetManager,
  setAssetManager,
  fetchAssetData,
  handleEdit,
  masterKey = "Students",
}) => {
  const start =
    assetManager.pagination.totalCount === 0
      ? 0
      : (assetManager.pagination.page - 1) * assetManager.pagination.pageSize +
        1;
  const end = start + assetManager.assetData.length - 1;

  const handlePageChange = (typeOrPageNum) => {
    let newPage;

    if (typeOrPageNum === "next") {
      newPage = Math.min(
        assetManager.pagination.page + 1,
        assetManager.pagination.totalPages
      );
    } else if (typeOrPageNum === "prev") {
      newPage = Math.max(assetManager.pagination.page - 1, 1);
    } else {
      newPage = typeOrPageNum;
    }

    setAssetManager((prev) => ({
      ...prev,
      selectedRowIds: [],
      pagination: {
        ...prev.pagination,
        page: newPage,
      },
    }));

    fetchAssetData(newPage, assetManager.pagination.pageSize);
  };

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    const allIds = checked ? assetManager.assetData.map((item) => item.id) : [];

    const updatedAssets = assetManager.assetData.map((item) => ({
      ...item,
      selected: checked,
    }));

    setAssetManager((prev) => ({
      ...prev,
      selectedRowIds: allIds,
      assetData: updatedAssets,
    }));
  };

  return (
    <div className="table-container">
      <div className="table-responsive">
        <table className="table mb-0">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>
                <input
                  type="checkbox"
                  checked={
                    !assetManager.loading &&
                    assetManager.assetData.length > 0 &&
                    assetManager.assetData.every((item) =>
                      assetManager.selectedRowIds.includes(item.id)
                    )
                  }
                  onChange={handleSelectAllChange}
                />
              </th>
              <th>S.No</th>
              <th>Name</th>
              <th>Member ID</th>
              <th>Mobile No</th>
              <th>Room No</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {assetManager.loading ? (
              <TableSkeleton />
            ) : assetManager.assetData.length > 0 ? (
              assetManager.assetData.map((asset, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="checkbox"
                      checked={assetManager.selectedRowIds.includes(asset.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updatedIds = checked
                          ? [...assetManager.selectedRowIds, asset.id]
                          : assetManager.selectedRowIds.filter(
                              (id) => id !== asset.id
                            );

                        setAssetManager((prev) => ({
                          ...prev,
                          selectedRowIds: updatedIds,
                        }));

                        const updatedAssets = assetManager.assetData.map(
                          (item) =>
                            item.id === asset.id
                              ? { ...item, selected: checked }
                              : item
                        );

                        setAssetManager((prev) => ({
                          ...prev,
                          assetData: updatedAssets,
                        }));
                      }}
                    />
                  </td>

                  <td>
                    {(assetManager.pagination.page - 1) *
                      assetManager.pagination.pageSize +
                      index +
                      1}
                  </td>

                  {/* Correct Student Fields */}
                  <td>{asset.name}</td>
                  <td>{asset.memberid}</td>
                  <td>{asset.mobile}</td>
                  <td>{asset?.locations?.map((l) => l.name).join(", ")}</td>

                  <td>
                    <button
                      className="btn btn-edit btn-sm me-2"
                      onClick={() => handleEdit(asset.id)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      className="btn btn-delete btn-sm me-2"
                      onClick={() =>
                        setAssetManager((prev) => ({
                          ...prev,
                          deleteModal: { show: true, id: asset.id },
                        }))
                      }
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                    <button
                      className="btn btn-sm text-white"
                      style={{
                        background: "linear-gradient(90deg, #1E90FF, #00BFFF)",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        color: "#fff",
                      }}
                      onClick={() => {
                        console.log("Biometric clicked for:", asset.id);
                      }}
                    >
                      <i className="bi bi-person-bounding-box me-1"></i> Bio
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-3">
                  No Data Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        masterKey={masterKey}
        assetMasters={{
          page: assetManager.pagination.page,
          totalCount: assetManager.pagination.totalCount,
          pageSize: assetManager.pagination.pageSize,
          totalPages: assetManager.pagination.totalPages,
          loading: assetManager.loading,
        }}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default StudentTable;
