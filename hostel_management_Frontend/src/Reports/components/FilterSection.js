/* eslint-disable eqeqeq */
import React from "react";

const FilterSection = ({
  reportConfig,
  fetchCategoryList,
  setTrackingState,
  trackingState,
}) => {
  const formData = trackingState.formData || {};
  const dropdownList = trackingState.dropdownList || {};

  const handleInputChange = (bkname, value) => {
    setTrackingState((prev) => ({
      ...prev,
      formData: { ...prev.formData, [bkname]: value },
      showTable: false,
      tableData: null,
    }));
  };

  const handleDropdownChange = (field, value) => {
    const { bkname, isCategoryRoot } = field;
    handleInputChange(bkname, value);

    console.log({ isCategoryRoot });

    if (isCategoryRoot) {
      if (value !== "") {
        fetchCategoryList(value);
      }

      setTrackingState((prev) => ({
        ...prev,
        dropdownList: { ...prev.dropdownList, categories: [] },
      }));
    }
  };

  const renderInput = (field) => {
    const { dpname, bkname, type } = field;
    const value = formData[bkname] || "";

    let minDate, maxDate;

    if (type === "date") {
      if (bkname === "toDate" && formData.fromDate) {
        minDate = formData.fromDate; // normal To Date logic
      }
      // else if (bkname === "expirydate") {
      //   // Expiry Date should be today or future
      //   minDate = new Date().toISOString().split("T")[0];
      // }
      else {
        minDate = undefined;
      }

      // Remove max restriction for expirydate so future dates allowed
      // maxDate =
      //   bkname === "expirydate"
      //     ? undefined
      //     : new Date().toISOString().split("T")[0];
    }

    return (
      <input
        onChange={(e) => handleInputChange(bkname, e.target.value)}
        type={type}
        min={minDate}
        max={maxDate}
        value={value}
        className="form-control"
        placeholder={`Enter ${dpname}`}
      />
    );
  };

  const renderDropdown = (field) => {
    const { dpname, bkname, backendAccessKey } = field;
    const value = formData[bkname] || "";

    return (
      <select
        className="form-select bg-white"
        value={value}
        onChange={(e) => handleDropdownChange(field, e.target.value)}
      >
        <option value="">Select {dpname}</option>
        {Array.isArray(dropdownList[bkname]) &&
          dropdownList[bkname]?.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt[backendAccessKey] ?? opt.name}
            </option>
          ))}
      </select>
    );
  };

  const renderTextarea = (field) => {
    const { dpname, bkname } = field;
    const value = formData[bkname] || "";

    return (
      <textarea
        className="form-control"
        rows={3}
        placeholder={`Enter ${dpname}`}
        value={value}
        onChange={(e) => handleInputChange(bkname, e.target.value)}
      />
    );
  };

  const renderers = {
    dropdown: renderDropdown,
    textarea: renderTextarea,
    text: renderInput,
    date: renderInput,
    number: renderInput,
    email: renderInput,
  };

  const renderField = (field) => {
    const { dpname, bkname, type } = field;
    const Renderer = renderers[type] || renderInput;

    return (
      <div className="col-md-3" key={bkname || field.key}>
        <label className="input-label inputlabellastassettracking">
          {dpname}
        </label>
        {Renderer(field)}
      </div>
    );
  };

  const renderSubCategorySection = () => {
    return dropdownList?.categories?.map((list, index) => {
      const hasAllValues = list.option?.every((opt) => opt.value);
      return (
        <React.Fragment key={`cat-${index}`}>
          {hasAllValues ? (
            list.option.map((opt, i) => (
              <div className="col-md-4" key={opt.id || i}>
                <label className="input-label inputlabellastassettracking">
                  Sub Category {i + 1}
                </label>
                <input
                  key={opt.id}
                  className="form-control mb-2"
                  type="text"
                  value={opt.value}
                  readOnly
                />
              </div>
            ))
          ) : (
            <div className="col-md-4" key={`dropdown-${index}`}>
              <label className="input-label inputlabellastassettracking">
                Category {index + 1}
              </label>
              <select
                className="form-select bg-white"
                // onChange={(e) => {
                //     const selectedId = e.target.value;

                //     // fetchCategoryList(selectedId);

                //     // setTrackingState((prev) => {
                //     //     const newCategories = [...prev.dropdownList.categories];
                //     //     newCategories.splice(index + 1, newCategories.length - (index + 1));  // Remove items after the clicked index

                //     //     // Update the options of the clicked category to add active:true
                //     //     newCategories[index] = {
                //     //         ...newCategories[index],
                //     //         option: newCategories[index].option.map((item) => ({
                //     //             ...item,
                //     //             // eslint-disable-next-line eqeqeq
                //     //             active: item.id == selectedId, // Add active flag
                //     //         })),
                //     //     };

                //     //     return {
                //     //         ...prev,
                //     //         dropdownList: { ...prev.dropdownList, categories: newCategories },
                //     //         showTable: false
                //     //     };
                //     // });

                //     setTrackingState((prev) => {
                //         const newCategories = [...prev.dropdownList.categories];

                //         // When user unselects (chooses "")
                //         if (!selectedId) {
                //             // Remove lower-level dropdowns
                //             newCategories.splice(index + 1, newCategories.length - (index + 1));

                //             // Set only this dropdown's options to inactive
                //             newCategories[index] = {
                //                 ...newCategories[index],
                //                 option: newCategories[index].option.map((opt) => ({
                //                     ...opt,
                //                     active: false,
                //                 })),
                //             };

                //             return {
                //                 ...prev,
                //                 dropdownList: { ...prev.dropdownList, categories: newCategories },
                //                 showTable: false,
                //             };
                //         }

                //         // Normal selection flow
                //         fetchCategoryList(selectedId);

                //         // Remove next dropdown levels
                //         newCategories.splice(index + 1, newCategories.length - (index + 1));

                //         // Mark only the selected option as active
                //         newCategories[index] = {
                //             ...newCategories[index],
                //             option: newCategories[index].option.map((item) => ({
                //                 ...item,
                //                 active: item.id == selectedId,
                //             })),
                //         };

                //         return {
                //             ...prev,
                //             dropdownList: { ...prev.dropdownList, categories: newCategories },
                //             showTable: false,
                //         };
                //     });
                // }}

                onChange={(e) => {
                  const selectedId = e.target.value;

                  setTrackingState((prev) => {
                    const newCategories = [...prev.dropdownList.categories];

                    // Remove all lower-level dropdowns
                    newCategories.splice(
                      index + 1,
                      newCategories.length - (index + 1)
                    );

                    // Update active flag (set only selected true, others false)
                    newCategories[index] = {
                      ...newCategories[index],
                      option: newCategories[index].option.map((opt) => ({
                        ...opt,
                        active: selectedId ? opt.id == selectedId : false,
                      })),
                    };

                    return {
                      ...prev,
                      dropdownList: {
                        ...prev.dropdownList,
                        categories: newCategories,
                      },
                      showTable: false,
                    };
                  });

                  // Call API only if something is selected
                  if (selectedId) {
                    fetchCategoryList(selectedId);
                  }
                }}
              >
                <option value="">Select Category </option>
                {list.option?.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name || opt.value}
                  </option>
                ))}
              </select>
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {reportConfig?.fields
        .filter((field) => field.showInFilter) // <-- only fields for filters
        .map(renderField)}

      {trackingState.dropdownList.categories &&
        trackingState.dropdownList.categories.length > 0 &&
        renderSubCategorySection()}
    </>
  );
};

export default FilterSection;
