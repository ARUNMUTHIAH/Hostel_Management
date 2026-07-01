/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useState } from 'react';
import './producttypemasters.css';
import SidebarDashboard from '../Sidebar/sidebar';
import { API_URL } from '../API_URL';
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import errorHandlers from '../utils/errorHandlers';
import { handleTokenExpired } from '../utils/errorHandlers';

const pageSize = 2;

const createProductType = (parentId = null) => ({
  id: crypto.randomUUID(),
  name: "",
  parent_id: parentId,
  children: [],
  isNew: true,
  editnew: false,
  type: "C",
});

export default function ProductTypeMaster() {
  const token = sessionStorage.getItem("accessToken");
  const [productTypes, setProductTypes] = useState([]);
  const [newProductTypes, setNewProductTypes] = useState([]);
  const [editedProductTypes, setEditedProductTypes] = useState([]);
  const [editNewProductTypes, setEditNewProductTypes] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [removedBackendIds, setRemovedBackendIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    totalPages: 1,
    backendCount: 0,
    removedCount: 0,
  });
  const totalPagenumber = Math.ceil((pagination.backendCount + newProductTypes.length) / pageSize);
  console.log({ editNewProductTypes, newProductTypes, productTypes });
  useEffect(() => {
    fetchData(undefined, undefined, undefined, undefined, undefined, true);
  }, []);

  const mergeEditNewWithBackend = (data) => {
    const attachChildren = (item) => {
      const matched = editNewProductTypes.filter(child => child.parent_id === item.id);
      if (matched.length > 0) {
        matched.forEach(match => {
          if (!item.children.find(c => c.id === match.id)) {
            item.children.push(match);
          }
        });
      }
      if (item.children?.length > 0) {
        item.children = item.children.map(child => attachChildren(child));
      }
      return item;
    };

    return data.map(item => attachChildren({ ...item }));
  };

  const fetchData = async (page = pagination.page, pageSize = pagination.pageSize, newProducts = newProductTypes, forceBackendReload = false, isEditMerge = true, isEdit = false) => {
    if ((page <= pagination.totalPages) || forceBackendReload) {
      try {
        setIsLoading(isEdit);
        const url = `${API_URL}/master?page=${page}&pagesize=${pageSize}`;
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.status) {
          const result = response.data.data || [];
          const totalCount = response.data.count || 0;
          const totalPages = Math.ceil(totalCount / pageSize);

          const isHybrid = totalCount % pageSize !== 0 && page === totalPages;
          const localData = isHybrid ? newProducts.slice(0, pageSize - result.length) : [];
          const mergedResult = isEditMerge ? mergeEditNewWithBackend([...result, ...localData]) : [...result, ...localData];


          setProductTypes(mergedResult);
          setPagination(prev => ({ ...prev, totalPages, backendCount: totalCount }));
        } else {
          if (response.data.message === "Token expired") {
            handleTokenExpired();
            return null;
          }
          setProductTypes([]);
        }

      } catch (error) {
        const errorMessage = errorHandlers.handleCommonApiError(error, "Failed to fetch product type.");
        toast.error(errorMessage, { autoClose: 2000 });
      } finally {
        setIsLoading(false);
      }
    } else {
      const backendRemainder = pagination.backendCount % pageSize;
      const localPage = page - pagination.totalPages - 1;
      const hybridOffset = backendRemainder > 0 ? (pageSize - backendRemainder) : 0;
      const startIndex = (localPage * pageSize) + hybridOffset;
      const endIndex = startIndex + pageSize;
      setProductTypes(() => {
        return newProducts.slice(startIndex, endIndex);
      });

    }
  };

  const handleAddProductType = () => {
    // Check if any newProductTypes have empty names
    const hasUnfilled = newProductTypes.some(item => item.isNew && !item.name.trim());

    if (hasUnfilled) {
      toast.info("Please fill the existing new product type before adding another.");
      return;
    }

    const updated = [...newProductTypes, createProductType(null)];
    const combinedTotal = pagination.backendCount + updated.length;
    const newTotalPages = Math.ceil(combinedTotal / pageSize);

    setPagination(prev => ({ ...prev, page: newTotalPages }));
    setNewProductTypes(updated);
    fetchData(newTotalPages, pageSize, updated);
  };

  const handleInputChange = (id, value, list = productTypes) => {
    console.log("uhuhiij")
    const updatedList = list.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, name: value };
        if (!item.isNew) {
          const editedEntry = {
            id: item.id,
            name: value,
            parent_id: item.parent_id ?? null,
            type: item.type,
          };

          setEditedProductTypes(prev => {
            const already = prev.find(p => p.id === id);
            if (already) {
              return prev.map(p => p.id === id ? editedEntry : p);
            } else {
              return [...prev, editedEntry];
            }
          });
        }

        return updatedItem;
      }
      console.log("sdsdsd", item.id === id, item);
      return {
        ...item,
        children: handleInputChange(id, value, item.children),
      };
    });

    return updatedList;
  };

  const collectEditNewNested = (list) => {
    for (const item of list) {
      if (item.children?.length) {
        const editNewChildren = item.children.filter(child => child.editnew);

        for (const child of editNewChildren) {
          setEditNewProductTypes(prev => {
            const exists = prev.find(p => p.id === child.id);
            if (exists) {
              return prev.map(p => p.id === child.id ? child : p);
            }
            return [...prev, child];
          });
        }

        collectEditNewNested(item.children);
      }
    }
  };

  const addSubProductType = (parentId, productTypeList = productTypes) => {
    return productTypeList.map(productType =>
      productType.id === parentId
        ? {
          ...productType,
          children: [
            ...productType.children,
            {
              ...createProductType(parentId),
              type: "C",
              editnew: !productType.isNew
            }
          ]
        }
        : {
          ...productType,
          children: addSubProductType(parentId, productType.children)
        }
    );
  };

  const temp = (productTypeList, idToRemove) => productTypeList
    .filter(productType => {
      if (productType.id === idToRemove && !productType.isNew) {
        setRemovedBackendIds(prev => [...prev, productType.id]);
        return false;
      }
      return true;
    })
    .map(productType => ({
      ...productType,
      children: temp(productType.children, idToRemove),
    }));


  const removeProductTypeById = (idToRemove, productTypeList = productTypes) => {
    // 1. Handle top-level new product types
    const isTopLevelNew = newProductTypes.find(item => item.id === idToRemove);

    if (isTopLevelNew) {
      const updatedNew = newProductTypes.filter(item => item.id !== idToRemove);
      setNewProductTypes(updatedNew);

      const updatedDisplayed = productTypes.filter(item => item.id !== idToRemove);
      setProductTypes(updatedDisplayed);

      const totalItems = (pagination.backendCount + updatedNew.length);
      const newTotalPages = Math.ceil(totalItems / pageSize);
      const newPage = Math.min(pagination.page, newTotalPages || 1);

      setPagination(prev => ({
        ...prev,
        page: newPage,
      }));

      fetchData(newPage, pagination.pageSize, updatedNew);

      return updatedDisplayed;
    }

    // 2. Check if it's a newly added sub-category (not top-level)
    let removedNewSub = false;

    const removeFromTree = (items) => {
      return items
        .map(item => {
          if (item.id === idToRemove && item.isNew) {
            removedNewSub = true;
            return null;
          }
          return {
            ...item,
            children: removeFromTree(item.children || [])
          };
        })
        .filter(Boolean);
    };

    const updatedNewProductTypes = removeFromTree(newProductTypes);
    const updatedProductTypes = removeFromTree(productTypes);
    const updatedEditNew = removeFromTree(editNewProductTypes)
    console.log("idToRemove", idToRemove, productTypes, removedNewSub, updatedNewProductTypes);

    if (removedNewSub) {
      setNewProductTypes(updatedNewProductTypes);
      setProductTypes(updatedProductTypes);
      // Remove from editNewProductTypes as well
      setEditNewProductTypes(updatedEditNew);
      return updatedProductTypes; //  Do NOT call fetchData here
    }

    // 3. If it's an existing backend item
    const updatedList = temp(productTypeList, idToRemove);
    const isRoot = productTypeList.find(item => item.id === idToRemove);
    const updatedCount = isRoot ? pagination.removedCount + 1 : pagination.removedCount;
    const totalItems = (pagination.backendCount + newProductTypes.length) - updatedCount;
    const newTotalPages = Math.ceil(totalItems / pageSize);
    const newPage = Math.min(pagination.page, newTotalPages || 1);


    setProductTypes(updatedList);
    setPagination(prev => ({
      ...prev,
      totalPages: newTotalPages,
      page: newPage,
      removedCount: updatedCount
    }));

    fetchData(newPage, pageSize, newProductTypes);

    return updatedList;
  };

  const syncWithNewProductTypes = (updatedProductType) => {
    const updatedNew = newProductTypes.map((newPro) => {
      const matched = updatedProductType.find((product) => product.id === newPro.id);
      return matched ? matched : newPro;
    });
    setNewProductTypes(updatedNew);
  };

  // const handleTypeChange = (id, newType) => {
  //    console.log("yuyuyuy")
  //   const updateTypeAndCleanChildren = (list) =>
  //     list.map((item) => {
  //       if (item.id === id) {
  //         return {
  //           ...item,
  //           type: newType,
  //           children: newType === "V" ? [] : item.children,
  //         };
  //       }
  //       return {
  //         ...item,
  //         children: updateTypeAndCleanChildren(item.children || []),
  //       };
  //     });

  //   const updated = updateTypeAndCleanChildren(productTypes);
  //   setProductTypes(updated);
  //   syncWithNewProductTypes(updated);
  //   collectEditNewNested(updated);
  //   return updated;
  // };

  // const handleTypeChange = (id, newType) => {
  //   const updateTypeAndManageChildren = (list) =>
  //     list.map((item) => {
  //       if (item.id === id) {
  //         let updatedItem = { ...item };

  //         if (newType === "V") {
  //           // Save children before clearing
  //           updatedItem = {
  //             ...item,
  //             type: newType,
  //             tempChildren: item.children, // backup
  //             children: [],
  //           };
  //         } else if (newType === "C") {
  //           // Restore children from backup (if available)
  //           updatedItem = {
  //             ...item,
  //             type: newType,
  //             children: item.tempChildren || [],
  //           };
  //           delete updatedItem.tempChildren;
  //         }

  //         // Save to edited list
  //         if (!item.isNew) {
  //           const editedEntry = {
  //             id: item.id,
  //             name: item.name,
  //             parent_id: item.parent_id ?? null,
  //             type: newType,
  //           };

  //           setEditedProductTypes((prev) => {
  //             const already = prev.find((p) => p.id === id);
  //             if (already) {
  //               return prev.map((p) => (p.id === id ? editedEntry : p));
  //             } else {
  //               return [...prev, editedEntry];
  //             }
  //           });
  //         }

  //         return updatedItem;
  //       }

  //       return {
  //         ...item,
  //         children: updateTypeAndManageChildren(item.children || []),
  //       };
  //     });

  //   const updated = updateTypeAndManageChildren(productTypes);
  //   setProductTypes(updated);
  //   syncWithNewProductTypes(updated);
  //   collectEditNewNested(updated);
  //   return updated;
  // };

  const handleTypeChange = (id, newType) => {
    const collectRemovedIds = [];

    const updateTypeAndCleanChildren = (list) =>
      list.map((item) => {
        if (item.id === id) {
          const childrenToRemove = item.children || [];

          // Collect backend children to delete
          if (newType === "V" && childrenToRemove.length) {
            const collectIds = (children) => {
              for (const child of children) {
                if (!child.isNew) collectRemovedIds.push(child.id);
                if (child.children?.length) collectIds(child.children);
              }
            };
            collectIds(childrenToRemove);
          }

          const updatedItem = {
            ...item,
            type: newType,
            children: newType === "V" ? [] : item.children,
          };

          // Track edited
          if (!item.isNew) {
            const editedEntry = {
              id: item.id,
              name: item.name,
              parent_id: item.parent_id ?? null,
              type: newType,
            };

            setEditedProductTypes((prev) => {
              const already = prev.find((p) => p.id === id);
              return already
                ? prev.map((p) => (p.id === id ? editedEntry : p))
                : [...prev, editedEntry];
            });
          }

          return updatedItem;
        }

        return {
          ...item,
          children: updateTypeAndCleanChildren(item.children || []),
        };
      });

    const updated = updateTypeAndCleanChildren(productTypes);
    setProductTypes(updated);
    syncWithNewProductTypes(updated);
    collectEditNewNested(updated);

    // 🔁 Update removedBackendIds with collected child IDs
    if (collectRemovedIds.length) {
      setRemovedBackendIds((prev) => [...prev, ...collectRemovedIds]);
    }

    return updated;
  };

  const renderProductTypes = (productTypeList, level = 0) => (
    productTypeList?.map((productType) => {
      const isRemoved = removedBackendIds.includes(productType.id);

      // If the current item is removed AND it's a parent (not a child), show message and skip children
      if (isRemoved) {
        return (
          <div key={productType.id} style={{ marginLeft: `${level * 30}px` }} className="mb-2">
            <div className="text-danger fst-italic">This product has been removed.</div>
          </div>
        );
      }

      const edited = editedProductTypes.find(p => p.id === productType.id);
      const name = edited?.name || productType.name;
      const type = productType.type || "C";

      return (
        <div key={productType.id} className="product-type-item" style={{ marginLeft: "15px" }} >
          <div className="d-flex align-items-center mb-2">
            {/* Show dropdown only if not top-most item (i.e. level > 0) */}
            {level > 0 && isEditMode && (
              <select
                className={`producttype-select me-2 ${type === 'C' ? 'select-c' : 'select-v'}`}
                value={type}
                onChange={(e) => handleTypeChange(productType.id, e.target.value)}
              >
                <option className="producttype-select me-2 select-v" value="C">C</option>
                <option className="producttype-select me-2 select-v" value="V">V</option>
              </select>
            )}
            <input
              type="text"
              className="form-control product-input me-2"
              placeholder="Product Type"
              value={name}
              disabled={!isEditMode}
              onChange={(e) => {
                const updatedTree = handleInputChange(productType.id, e.target.value);
                setProductTypes(updatedTree);
                syncWithNewProductTypes(updatedTree);
                collectEditNewNested(updatedTree);
              }}
            />
            {/* {isEditMode && (type !== "value") && (
              <div className="button-group d-flex gap-1">
                <button className="btn plus-btn" onClick={() => setProductTypes(addSubProductType(productType.id))}>
                  <i className="bi bi-plus"></i>
                </button>
                <button className="btn minus-btn" onClick={() => setProductTypes(removeProductTypeById(productType.id))}>
                  <i className="bi bi-dash"></i>
                </button>
              </div>
            )} */}

            {isEditMode && (
              <div className="button-group d-flex gap-1">
                {type !== "V" && (
                  <button className="btn plus-btn" onClick={() => setProductTypes(addSubProductType(productType.id))}>
                    <i className="bi bi-plus"></i>
                  </button>
                )}
                <button className="btn minus-btn" onClick={() => setProductTypes(removeProductTypeById(productType.id))}>
                  <i className="bi bi-dash"></i>
                </button>
              </div>
            )}

          </div>

          {/* Recursively render children that are not removed */}
          {type !== "V" && productType?.children?.length > 0 &&
            renderProductTypes(
              productType.children.filter(child => !removedBackendIds.includes(child.id)),
              level + 1
            )
          }
        </div>
      );
    })
  );

  // const handlePageChange = (type, number = null) => {
  //   let newPage = pagination.page;
  //   if (type === 'next') newPage += 1;
  //   else if (type === 'prev') newPage -= 1;
  //   else if (type === 'number') newPage = number;

  //   setPagination(prev => ({ ...prev, page: newPage }));
  //   fetchData(newPage);
  // };

  const cleanNested = (items) => {
    return items.map(item => ({
      name: item.name,
      children: item.children ? cleanNested(item.children) : [],
      type: item.type
    }));
  };

  const handleSave = async () => {
    if (saving) return; // prevent double click
    setSaving(true);

    // Recursively check if any item or its children has empty name
    // const hasEmptyName = (list) => {
    //   for (const item of list) {
    //     if (!item.name?.trim()) return true;
    //     console.log("bui", item, item.children?.length)
    //     if (item.children?.length && hasEmptyName(item.children)) return true;
    //   }
    //   return false;
    // };

    const hasEmptyName = (list) => {
      console.log({ list })
      for (const item of list) {
        if (!item.name?.trim()) {
          console.log("Empty name found in item:", item);
          return true;
        }
        if (item.children?.length && hasEmptyName(item.children)) {
          return true;
        };
      }
      return false;
    };

    const hasEmptyEditNewNames = (list) => {
      for (const item of list) {
        if (item.editnew && !item.name?.trim()) return true;
        if (item.children?.length && hasEmptyEditNewNames(item.children)) return true;
      }
      return false;
    };


    // 1. Check newProductTypes
    if (hasEmptyName(newProductTypes)) {
      toast.error("Please fill in all product type names before saving.", {
        onClose: () => { setSaving(false); },
      });
      return;
    }

    // 2. Check editedProductTypes
    const editedHasEmpty = editedProductTypes.some(item => !item.name?.trim());
    if (editedHasEmpty) {
      toast.error("Please fill in all edited product type names.", {
        onClose: () => { setSaving(false); },
      });
      return;
    }

    // 3. Check editNewProductTypes and their children
    // if (hasEmptyName(editNewProductTypes)) {
    //   toast.error("Please fill in all added sub-product type names.");
    //   setSaving(false);
    //   return;
    // }

    if (hasEmptyEditNewNames(productTypes)) {
      toast.error("Please fill in all added sub-product type names.", {
        onClose: () => { setSaving(false); },
      });
      return;
    }


    const newItems = [];
    const editNewItems = [];

    // Utility to clean id, parent_id, and isNew for fully new items
    const stripIdsAndFlags = (items) => {
      return items.map(({ id, parent_id, isNew, children, ...rest }) => ({
        ...rest,
        children: children ? stripIdsAndFlags(children) : [],
      }));
    };

    const collectEditNew = (list) => {
      for (const item of list) {
        //old
        if (!item.isNew) {
          const newChildren = item.children?.filter(child => child.isNew) || [];

          if (newChildren.length > 0) {
            editNewItems.push({
              name: item.name,
              parent_id: item.id,
              type: item.type,
              children: cleanNested(newChildren)
            });
          }
        } else if (item.parent_id === null) {
          newItems.push(stripIdsAndFlags([item])[0]);
        }

        if (item.children?.length > 0) collectEditNew(item.children);
      }
    };

    collectEditNew(newProductTypes);

    const cleanedEditNew = editNewProductTypes.map(item => ({
      name: item.name,
      parent_id: item.parent_id,
      type: item.type,
      children: cleanNested(item.children || [])
    }));


    const payload = {
      new: [...editNewItems, ...cleanedEditNew, ...newItems],
      edit: editedProductTypes,
      // edit_new: [...editNewItems, ...cleanedEditNew],
      delete: removedBackendIds,
    };

    //  No changes check
    const noChanges = payload.new.length === 0 && payload.edit.length === 0 && payload.delete.length === 0;

    if (noChanges) {
      toast.info("No changes to save.", { autoClose: 1500, onClose: () => setSaving(false), });
      return;
    }


    try {
      // const url = `${API_URL}/master`;
      const response = await axios.put(`${API_URL}/master`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.data.status) {
        toast.success(response.data.message);
        setNewProductTypes([]);
        setEditedProductTypes([]);
        setEditNewProductTypes([]);
        setIsEditMode(false);
        setRemovedBackendIds([]);

        // setPagination(prev => ({ ...prev, page: 1 }));
        const backendCountAfterDelete = pagination.backendCount - pagination.removedCount;
        const estimatedTotalPages = Math.ceil((backendCountAfterDelete + newProductTypes.length) / pageSize);

        const adjustedPage = pagination.page > estimatedTotalPages
          ? estimatedTotalPages
          : pagination.page;

        setPagination(prev => ({
          ...prev,
          page: adjustedPage,
          backendCount: backendCountAfterDelete,
          removedCount: 0,
        }));

        fetchData(adjustedPage, pagination.pageSize, [], true, false, true); // Force API fetch
        // setPagination(prev => ({
        //   ...prev,
        //   backendCount: prev.backendCount - removedBackendIds.length + newItems.length,
        // }));


      } else {
        if (response.data.message === "Token expired") {
          handleTokenExpired();
          return null;
        }
        toast.error(response.data.message);
      }
    } catch (error) {
      const errorMessage = errorHandlers.handleCommonApiError(error, "Failed to fetch product type.");
      toast.error(errorMessage, { autoClose: 2000 });
    } finally {
      setSaving(false);
    }
  };

  // const renderPaginationNumbers = () => {
  //   const pages = [];
  //   const currentPage = pagination.page;
  //   const total = totalPagenumber;

  //   let startPage = Math.max(1, currentPage - 2);
  //   let endPage = Math.min(total, currentPage + 2);

  //   if (currentPage <= 3) {
  //     startPage = 1;
  //     endPage = Math.min(5, total);
  //   } else if (currentPage > total - 3) {
  //     startPage = Math.max(1, total - 4);
  //     endPage = total;
  //   }

  //   for (let i = startPage; i <= endPage; i++) {
  //     pages.push(
  //       <li key={i} className={`page-item ${pagination.page === i ? 'active' : ''}`}>
  //         <a href="#" className="page-link" onClick={(e) => { e.preventDefault(); handlePageChange("number", i); }}>{i}</a>
  //       </li>
  //     );
  //   }

  //   return pages;
  // };

  const renderPaginationNumbers = () => {
    const pages = [];
    const currentPage = pagination.page;
    const total = totalPagenumber;

    const addPage = (page) => {
      pages.push(
        <li key={page} className={`page-item ${pagination.page === page ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}>
          <a href="#" className="page-link" onClick={(e) => {
            e.preventDefault();
            if (!isLoading && pagination.page !== page) {
              handlePageChange("number", page);
            };
          }}>
            {page}
          </a>
        </li>
      );
    };

    const addEllipsis = (key) => {
      pages.push(
        <li key={key} className="page-item disabled">
          <span className="page-link">...</span>
        </li>
      );
    };

    if (total <= 7) {
      // Show all pages if total is small
      for (let i = 1; i <= total; i++) addPage(i);
    } else {
      if (currentPage <= 4) {
        // Start range
        for (let i = 1; i <= 5; i++) addPage(i);
        addEllipsis('end');
        addPage(total);
      } else if (currentPage >= total - 3) {
        // End range
        addPage(1);
        addEllipsis('start');
        for (let i = total - 4; i <= total; i++) addPage(i);
      } else {
        // Middle range
        addPage(1);
        addEllipsis('start');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) addPage(i);
        addEllipsis('end');
        addPage(total);
      }
    }

    return pages;
  };

  const handlePageChange = (type, value = null) => {

    let newPage = pagination.page;
    if (type === "next") newPage += 1;
    if (type === "prev") newPage -= 1;
    if (type === "number") newPage = value;

    // newPage = Math.max(1, Math.max(newPage, pagination.totalPages));
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchData(newPage, undefined, undefined, undefined, undefined, true);
  };

  return (
    <div className='d-flex assetproducttypemasters hms-app-shell'>
      <SidebarDashboard />
      <div className="main-content flex-grow-1">
        <div className="min-h-screen flex flex-col">
          <div className="container flex-grow d-flex flex-column hms-page">
            <div className="hms-page-header mb-4 producttypeactionbuttons">
              <div className="hms-page-header__title-row">
                <div className="hms-page-header__icon">
                  <i className="bi bi-diagram-3-fill"></i>
                </div>
                <div>
                  <h1 className="hms-page-title">{sessionStorage.getItem("activeSidebarName") || "Product Type Masters"}</h1>
                  <p className="hms-page-subtitle">Configure product type hierarchy</p>
                </div>
              </div>
              {isEditMode ?
                <div>
                  <button id="addProductType" className="btn btn-primary addproducttypebutton" style={{ backgroundColor: "#009FF7" }} onClick={handleAddProductType}>+ Add Product Type</button>
                  <img
                    src="images/producttypemastersavebtn.png"
                    alt="Save"
                    className="producttypemasterssave-button-image ms-2"
                    onClick={saving ? null : handleSave}
                    style={{ cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}
                  />
                  <img
                    src="images/producttypemasterscancelbtn.png"  // <-- Use your actual image path here
                    alt="Cancel"
                    className="producttypemasterscancel-button-image ms-2"
                    onClick={() => {
                      setNewProductTypes([]);
                      setEditedProductTypes([]);
                      setEditNewProductTypes(() => {
                        return [];
                      });
                      setProductTypes([]);
                      setRemovedBackendIds([]);

                      // const newPage = 1;
                      // setPagination(prev => ({ ...prev, page: newPage }));
                      const checkPage = (pagination.page > pagination.totalPages) ? pagination.totalPages : pagination.page;

                      console.log({ checkPage }, pagination.page, pagination.totalPages)
                      //22, 22, 23
                      if (checkPage) {
                        setPagination(prev => ({ ...prev, page: checkPage, removedCount: 0, }));
                      }
                      fetchData(checkPage, pagination.pageSize, [], false, false, true);
                      setIsEditMode(false);
                    }}
                  />
                </div>
                :
                <div>
                  <button className="edit-icon btn ms-2 d-flex align-items-center justify-content-center" onClick={() => setIsEditMode(true)} >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                </div>
              }
            </div>

            {/* product section */}
            <div className="row flex-grow">
              <div className="col-md-12">
                <div className="product-section">
                  {isLoading ? (
                    <div className="p-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="d-flex align-items-center mb-3 gap-2">
                          <div className="shimmer-block shimmer-dropdown"></div>
                          <div className="shimmer-block shimmer-input"></div>
                          <div className="shimmer-block shimmer-button"></div>
                          <div className="shimmer-block shimmer-button"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderProductTypes(productTypes)
                  )}

                </div>
              </div>
            </div>
          </div>

          {/* Pagination */}

          <div className="page-footer  p-3 mt-auto d-flex justify-content-end align-items-center">
            <nav>
              <ul className="pagination">
                {renderPaginationNumbers()}
                <li className={`page-item ${pagination.page === 1 || isLoading ? 'disabled' : ''}`}>
                  <a href="#" className="page-link" onClick={(e) => { e.preventDefault(); handlePageChange("prev"); }}>Previous</a>
                </li>
                <li className={`page-item ${pagination.page === totalPagenumber || isLoading ? 'disabled' : ''}`}>
                  <a href="#" className="page-link" onClick={(e) => { e.preventDefault(); handlePageChange("next"); }}>Next</a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="d-flex align-items-center justify-content-center">
            <img
              src="images/2cqrfooterlogo.png"
              alt="Logo"
              className="footer-logo me-2"
              width="30"
            />
            <strong>2cqr &copy; 2025</strong>
          </div>

        </div>
      </div>
      <ToastContainer />
    </div>
  );
}