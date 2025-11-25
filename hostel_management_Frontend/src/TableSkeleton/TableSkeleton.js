import React, { useEffect } from "react";
import { TableRow, TableCell, Skeleton } from "@mui/material";

const TableSkeleton = ({ rows = 10, columns = 6, rowHeight = 25 }) => {
  useEffect(() => {
    // Log what’s being generated
    console.log("Rendering TableSkeleton:");
    console.log("Rows:", rows);
    console.log("Columns:", columns);
    console.log("Row Height:", rowHeight);
  }, [rows, columns, rowHeight]);

  return (
    <>
      {[...Array(rows)].map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {[...Array(columns)].map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton variant="rounded" animation="wave" height={rowHeight} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

export default TableSkeleton;
