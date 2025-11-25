import React from "react";

const formatDateTime = (value) => {
  if (!value) return "-"; // return dash if empty

  const date = new Date(value);
  if (isNaN(date)) return value; // if not valid date, return as is

  // Format: DD-MMM-YYYY HH:mm AM/PM
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const ReportTable = ({ reportConfig, trackingState, setTrackingState }) => {
  const tableData = Array.isArray(trackingState.tableData)
    ? trackingState.tableData
    : [];

  return (
    <table className="table mb-0">
      <thead>
        <tr>
          {reportConfig.header?.map((headerItem, index) => (
            <th key={index}>{headerItem}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.length > 0 ? (
          tableData.map((data, index) => {
            const rowNumber =
              (trackingState.pagination.page - 1) *
                trackingState.pagination.pageSize +
              index +
              1;

            return (
              <React.Fragment key={index}>
                <tr>
                  <td>{rowNumber}</td>
                  {reportConfig.fields
                    .filter((field) => field.view)
                    .map((field, fieldIndex) => {
                      let value;

                      if (field.mergeKeys?.length) {
                        value = field.mergeKeys
                          .map((k) => data?.[k])
                          .filter(Boolean)
                          .join(", ");
                      } else {
                        const key = field.backendAccessKey || field.bkname;
                        value = data?.[key];
                      }

                      // ✅ Replace null/undefined/empty string with "-"
                      if (value === null || value === undefined || value === "")
                        value = "-";

                      // ✅ Format ISO date-time
                      if (
                        typeof value === "string" &&
                        value.includes("T") &&
                        value.includes("Z")
                      ) {
                        value = formatDateTime(value);
                      }

                      return <td key={fieldIndex}>{value}</td>;
                    })}
                </tr>
              </React.Fragment>
            );
          })
        ) : (
          <tr>
            <td
              colSpan={reportConfig.header?.length || 1}
              className="text-center"
            >
              No records found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default ReportTable;
