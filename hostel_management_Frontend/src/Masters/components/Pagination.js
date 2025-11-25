/* eslint-disable jsx-a11y/anchor-is-valid */
import React from 'react'

const Pagination = ({ masterKey, assetMasters, onPageChange }) => {
    const noData = assetMasters.totalCount === 0;
    console.log({ assetMasters });
    return (
        <div className="d-flex justify-content-between align-items-center mt-3 paginationandrecordinfo">
            {/* Records Info */}
            <div>
                {assetMasters.totalCount === 0 ? (
                    <>Showing 0 of 0 {masterKey}</>
                ) : (
                    <>
                        Showing {(assetMasters.page - 1) * assetMasters.pageSize + 1}-
                        {Math.min(assetMasters.page * assetMasters.pageSize, assetMasters.totalCount)} of{" "}
                        {assetMasters.totalCount} {masterKey}
                    </>
                )}
            </div>

            {/* Pagination */}
            <nav>
                <ul className="pagination pagination-sm mb-0">
                    {(() => {
                        const pages = [];
                        const { page, totalPages } = assetMasters;

                        const addPage = (p) =>
                            pages.push(
                                <li
                                    key={p}
                                    className={`page-item ${page === p ? "active" : ""} ${assetMasters.loading ? "disabled" : ""}`}
                                    onClick={() => {
                                        if (!assetMasters.loading && p !== assetMasters.page) {
                                            onPageChange(p);
                                        }
                                    }}

                                >
                                    <a className="page-link" href="#">{p}</a>
                                </li>
                            );

                        const addEllipsis = (key) =>
                            pages.push(
                                <li className="page-item disabled" key={key}>
                                    <span className="page-link">...</span>
                                </li>
                            );

                        if (totalPages <= 5) {
                            for (let i = 1; i <= totalPages; i++) addPage(i);
                        } else {
                            if (page <= 3) {
                                for (let i = 1; i <= 4; i++) addPage(i);
                                addEllipsis("end");
                                addPage(totalPages);
                            } else if (page >= totalPages - 2) {
                                addPage(1);
                                addEllipsis("start");
                                for (let i = totalPages - 3; i <= totalPages; i++) addPage(i);
                            } else {
                                addPage(1);
                                addEllipsis("start");
                                addPage(page - 1);
                                addPage(page);
                                addPage(page + 1);
                                addEllipsis("end");
                                addPage(totalPages);
                            }
                        }

                        return pages;
                    })()}

                    {/* Prev Button */}
                    <li className={`page-item ${assetMasters.page === 1 || assetMasters.loading ? "disabled" : ""}`}>
                        <a
                            className="page-link"
                            href="#"
                            onClick={() => {
                                if (assetMasters.page > 1) {
                                    const newPage = assetMasters.page - 1;
                                    onPageChange(newPage)
                                }
                            }}

                        >
                            Previous
                        </a>
                    </li>

                    {/* Next Button */}
                    <li
                        className={`page-item ${assetMasters.page === assetMasters.totalPages || assetMasters.loading || noData ? "disabled" : ""}`}
                    >
                        <a
                            className="page-link"
                            href="#"
                            onClick={() => {
                                if (assetMasters.page < assetMasters.totalPages) {
                                    const newPage = assetMasters.page + 1;
                                    onPageChange(newPage)
                                }
                            }}
                        >
                            Next
                        </a>
                    </li>
                </ul>
            </nav>
        </div>
    )
}

export default Pagination