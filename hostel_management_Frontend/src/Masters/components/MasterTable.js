/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import TableSkeleton from "../../TableSkeleton/TableSkeleton";

export const MasterTable = ({
  configMasters,
  assetMasters,
  onhandleSelectAll,
  onCheckboxChange,
  onEdit,
  onDelete,
}) => {
  const visibleColumns =
    configMasters?.filter((col) => col.view === "1")?.length || 0;
  const totalColumns = 2 + visibleColumns + 1; // Checkbox + S.No + Dynamic + Actions

  return (
    <div className="table-responsive">
      <table className="table table-striped mt-1">
        <thead>
          <tr>
            <th style={{ width: "5%" }}>
              {!assetMasters.loading && (
                <input
                  type="checkbox"
                  checked={
                    assetMasters.list &&
                    assetMasters.list.length > 0 &&
                    assetMasters.selectAll
                  }
                  onChange={(e) => onhandleSelectAll(e.target.checked)}
                />
              )}
            </th>
            <th style={{ width: "10%" }}>S.No</th>
            {configMasters
              ?.filter((column) => column.view === "1")
              ?.map((col, i) => (
                <th key={i} style={{ width: "20%" }}>
                  {col.dpname}
                </th>
              ))}
            <th style={{ width: "20%" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assetMasters.loading ? (
            // <tr>
            //     <td colSpan="100%" className="text-center py-4">
            //         <div className="spinner-border text-primary" role="status">
            //             <span className="visually-hidden">Loading...</span>
            //         </div>
            //     </td>
            // </tr>
            <TableSkeleton columns={totalColumns} />
          ) : assetMasters.list.length === 0 ? (
            <tr>
              <td colSpan="100%" className="text-center">
                No data found
              </td>
            </tr>
          ) : (
            assetMasters.list.map((data, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="checkbox"
                    checked={assetMasters?.selectedIds?.includes(data.id)}
                    onChange={() => onCheckboxChange(data.id)}
                  />
                </td>
                <td>
                  {(assetMasters.page - 1) * assetMasters.pageSize + index + 1}
                </td>

                {configMasters
                  ?.filter((column) => column.view === "1")
                  ?.map((col, i) => (
                    <td key={i}>{data[col.bkname]}</td>
                  ))}

                <td>
                  <button
                    className="btn btn-edit btn-sm me-2"
                    onClick={() => onEdit(data.id)}
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  <button
                    className="btn btn-delete btn-sm"
                    onClick={() => onDelete(data.id)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
