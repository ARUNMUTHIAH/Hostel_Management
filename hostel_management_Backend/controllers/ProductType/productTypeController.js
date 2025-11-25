import { db, performQuery } from "../../config/Database.js";
import { getCurrentISTTime, capitalizeFirstLetter } from "../../Utils/Datetime.js";
import { master_configuration } from "../../config/master_config.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

const MASTER_CONFIG = master_configuration();

// export const UpdateProductType = async (req, res) => {

//   const QueryTime = await getCurrentISTTime();
//   console.log('Current IST Time:', QueryTime);
//   console.log('NEW_MASTERS');

//   console.log('handled_updated_initiated', QueryTime);

//   const userId = req.user?.id;
//   const lastmodifiedby = userId;
  
//   try {
//     console.log('handled_updated_initiated1111', QueryTime);

//     let data = req.body;

//     function validateNoCAfterVInHierarchy(nodes, keyName = 'root') {
//       if (!Array.isArray(nodes)) return { success: true };

//       for (const node of nodes) {
//         const { type, children, name } = node || {};

//         if (type === 'V' && Array.isArray(children)) {
//           for (const child of children) {
//             if (child?.type) {
//               return {
//                 success: false,
//                 message: `Invalid child type '${child.type}' under 'V' node at '${keyName} -> ${name}'.`
//               };
//             }
//           }
//         }

//         if (Array.isArray(children)) {
//           const result = validateNoCAfterVInHierarchy(children, `${keyName} -> ${name}`);
//           if (!result.success) return result;
//         }
//       }

//       return { success: true };
//     }
//     const checks = [
//         validateNoCAfterVInHierarchy(data.edit, 'edit'),
//         validateNoCAfterVInHierarchy(data.new, 'new'),
//         validateNoCAfterVInHierarchy(data.edit_new, 'edit_new')
//     ];

//     const failedCheck = checks.find(c => !c.success);
//     if (failedCheck) {
//         return res.status(400).json({ status: false, message: failedCheck.message });
//     }
    
//     await db.query('START TRANSACTION');
    
//     if (Array.isArray(data.edit)) {
//       for (const item of data.edit) {
//         // const name = item.name?.trim();
//         const name = capitalizeFirstLetter(item.name);

//         const [[existing]] = await db.query(
//           `SELECT name, parent_id FROM master WHERE id = ?`,
//           { replacements: [item.id] }
//         );

//         if (existing?.name !== name) {
//           const [[dup]] = await db.query(
//             `SELECT id FROM master WHERE name = ? AND parent_id <=> ? AND id != ?`,
//             { replacements: [name, existing?.parent_id, item.id] }
//           );

//           if (dup) {
//             await db.query('ROLLBACK');
//             return res.status(400).json({ status: false, message: `Duplicate name '${name}' exists under this parent.` });
//           }
//         }

//         await db.query(
//           `UPDATE master SET name = ?, type = ?, lastmodifiedby = ? WHERE id = ?`,
//           { replacements: [name, item?.type || null, lastmodifiedby, item?.id] }
//         );
//       }
//     }
//     if (Array.isArray(data.new)) {
//       async function insertHierarchy(nodes, parentId = null, lastmodifiedby) {
//         const nameSet = new Set();

//         for (const node of nodes) {
//           const formattedName = capitalizeFirstLetter(node.name);
//           const nameKey = `${formattedName.toLowerCase()}_${parentId ?? 'null'}`;

//           // Check for duplicates in the request
//           if (nameSet.has(nameKey)) {
//             await db.query('ROLLBACK');
//             return res.status(400).json({
//               status: false,
//               message: `Duplicate name '${formattedName}' found in request under same parent.`,
//             });
//           }

//           nameSet.add(nameKey);

//           // Check for duplicates in DB
//           const [[dup]] = await db.query(
//             `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//             { replacements: [formattedName, parentId] }
//           );

//           if (dup) {
//             await db.query('ROLLBACK');
//             return res.status(400).json({
//               status: false,
//               message: `Duplicate name '${formattedName}' already exists.`,
//             });
//           }

//           // Insert with formatted name
//           const result = await db.query(
//             `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//             {
//               replacements: [
//                 formattedName,
//                 parentId,
//                 node?.type || null,
//                 lastmodifiedby,
//               ],
//             }
//           );

//           const insertedId = result[0];

//           // Recursively handle children
//           if (Array.isArray(node.children) && node.children.length > 0) {
//             await insertHierarchy(node.children, insertedId, lastmodifiedby);
//           }
//         }
//       }

//       await insertHierarchy(data.new, null, userId);
//     }

//     // if (Array.isArray(data.edit_new)) {
//     //     for (const item of data.edit_new) {
//     //         const parentId = item.parent_id || null;
//     //         const name = item?.name?.trim();

//     //         const [[dup]] = await db.query(
//     //             `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//     //             { replacements: [name, parentId] }
//     //         );
//     //         if (dup) {
//     //             await db.query('ROLLBACK');
//     //             return res.status(400).json({ status: false, message: `Duplicate name '${name}' already exists under this parent.`});
//     //         }

//     //         const result = await db.query(
//     //             `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//     //             { replacements: [name, parentId, item?.type || null, lastmodifiedby] }
//     //         );

//     //         const insertedId = result[0];
//     //         console.log(`Inserted node: ${name} with id: ${insertedId} under parent_id: ${parentId}`);

//     //         if (Array.isArray(item.children) && item.children.length > 0) {
//     //             const childNameSet = new Set();

//     //             for (const child of item.children) {
//     //                 const trimmed = child.name?.trim().toLowerCase();
//     //                 if (childNameSet.has(trimmed)) {
//     //                     await db.query('ROLLBACK');
//     //                     return res.status(400).json({ status: false, message: `Duplicate child '${child.name}' under '${name}' (in request)`});
//     //                 }
//     //                 childNameSet.add(trimmed);

//     //                 const [[childDup]] = await db.query(
//     //                     `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//     //                     { replacements: [child.name, insertedId] }
//     //                 );
//     //                 if (childDup) {
//     //                     await db.query('ROLLBACK');
//     //                     return res.status(400).json({ status: false, message: `Child duplicate '${child.name}' under ${name}`});
//     //                 }

//     //                 await db.query(
//     //                     `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//     //                     { replacements: [child.name, insertedId, child.type, lastmodifiedby] }
//     //                 );
//     //             }
//     //         }
//     //     }
//     // }
//     // if (Array.isArray(data.delete)) {
//     //     for (const id of data.delete) {
//     //         await db.query(
//     //             `DELETE FROM master WHERE id = ?`,
//     //             { replacements: [id] });
//     //     }
//     // }
//     if (Array.isArray(data.delete)) {
//         const allIdsToDelete = new Set();

//         for (const id of data.delete) {
//             const stack = [id];

//             while (stack.length > 0) {
//                 const currentId = stack.pop();
//                 allIdsToDelete.add(currentId);

//                 const [children] = await db.query(
//                     `SELECT id FROM master WHERE parent_id = ?`,
//                     { replacements: [currentId] }
//                 );
//                 for (const child of children) {
//                     stack.push(child.id);
//                 }
//             }
//         }
//         if (allIdsToDelete.size > 0) {
//             await db.query(
//                 `DELETE FROM master WHERE id IN (${[...allIdsToDelete].map(() => '?').join(',')})`,
//                 { replacements: [...allIdsToDelete] }
//             );
//         }
//     }

//     await db.query('COMMIT');
//     return res.status(200).json({ status: true, message: 'Product types updated successfully' });

//   } catch (error) {
//     await db.query('ROLLBACK');
//     console.error(error);
//     console.log('handled_updated_failed', QueryTime);
    
//       const errorFetch = handleSequelizeError(error);
//       const status_code = errorFetch?.statusCode || 500
//       const error_message = errorFetch?.message
//       const error_status = errorFetch?.status

//       res.status(status_code).json({
//           status: error_status,
//           message: error_message
//       });
//   }
// };

export const UpdateProductType = async (req, res) => {

  const QueryTime = await getCurrentISTTime();
  console.log('Current IST Time:', QueryTime);
  console.log('NEW_MASTERS');

  console.log('handled_updated_initiated', QueryTime);

  const userId = req.user?.userId;
  const lastmodifiedby = userId;
  
  try {
    console.log('handled_updated_initiated1111', QueryTime);
    let data = req.body;


    function validateNoCAfterVInHierarchy(nodes, keyName = 'root', insideV = false) {
    if (!Array.isArray(nodes)) return { success: true };
  
    for (const node of nodes) {
      const type = node?.type;
      console.log('Checking:', node.name, 'type:', type, 'insideV:', insideV);
    
      if (insideV && type === 'C') {
        return {
          success: false,
          message: `Invalid type sequence in 'C' cannot come after 'V'.`
        };
      } 
     
      const result = validateNoCAfterVInHierarchy(node.children || [], `${keyName} -> ${node.name}`, type === 'V');
      if (!result.success) return result;
    }
  
  return { success: true };
}


    const checks = [
        validateNoCAfterVInHierarchy(data.edit, 'edit'),
        validateNoCAfterVInHierarchy(data.new, 'new'),
        validateNoCAfterVInHierarchy(data.edit_new, 'edit_new')
    ];

    const failedCheck = checks.find(c => !c.success);
    if (failedCheck) {
        return res.status(400).json({ status: false, message: failedCheck.message });
    }

    
    async function checkDuplicateNamesInArray(arr, parentIdKey = 'parent_id', isEdit = false) {
      if (!Array.isArray(arr)) return null;
      const nameSet = new Set();
      for (const node of arr) {
        if ( !node.name || node.name.trim() === '' || node.name === null || node.name === undefined) {
          return 'Name cannot be empty please provide valid name.';
        }
        const formattedName = capitalizeFirstLetter(node.name);
        const parentId = node[parentIdKey] ?? null;
        const nameKey = `${formattedName.toLowerCase()}_${parentId}`;
        if (nameSet.has(nameKey)) {
          return `Duplicate name '${formattedName}' found in request under same parent.`;
        }
        nameSet.add(nameKey);
        
        // Check database for duplicates
        if (isEdit) {
          const [[dup]] = await db.query(
            `SELECT id FROM master WHERE name = ? AND parent_id <=> ? AND id != ?`,
            { replacements: [formattedName, parentId, node.id] }
          );
          if (dup) {
            return `Duplicate name '${formattedName}' exists under this parent.`;
          }
        } else {
          const [[dup]] = await db.query(
            `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
            { replacements: [formattedName, parentId] }
          );
          if (dup) {
            return `Duplicate name '${formattedName}' already exists.`;
          }
        }
        
        if (Array.isArray(node.children)) {
          const childDup = await checkDuplicateNamesInArray(node.children, 'parent_id', isEdit);
          if (childDup) return childDup;
        }
      }
      return null;
    }
    
    let duplicateError =
      await checkDuplicateNamesInArray(data.edit, 'parent_id', true) ||
      await checkDuplicateNamesInArray(data.new);
      // await checkDuplicateNamesInArray(data.delete);
    if (duplicateError) {
      return res.status(400).json({ status: false, message: duplicateError });
    }

    
    await db.query('START TRANSACTION');
    
    // Edit existing
    if (Array.isArray(data.edit)) {
        for (const item of data.edit) {
        const name = capitalizeFirstLetter(item.name);
            const [[existing]] = await db.query(
                `SELECT name, parent_id FROM master WHERE id = ?`,
                { replacements: [item.id] }
            );

            await db.query(
                `UPDATE master SET name = ?, type = ?, lastmodifiedby = ? WHERE id = ?`,
                { replacements: [name, item?.type || null, lastmodifiedby, item?.id] }
            );
        }
    }

    // Insert new
    if (Array.isArray(data.new)) {
      async function insertHierarchy(nodes, parentId , lastmodifiedby) {
        
          for (const node of nodes) {
          const formattedName = capitalizeFirstLetter(node.name);
          const realParentId = node.parent_id !== undefined && node.parent_id !== null ? node.parent_id : parentId || null;            
         // const nameKey = `${formattedName.toLowerCase()}_${realParentId ?? 'null'}`;
                const result = await db.query(
                    `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
            {
              replacements: [
                formattedName,
                realParentId,
                node?.type || null,
                lastmodifiedby,
              ],
            }
                );
                const insertedId = result[0];                
                if (Array.isArray(node.children) && node.children.length > 0) {
                    await insertHierarchy(node.children, insertedId, lastmodifiedby);
                }
            }
        }
      try {
        await insertHierarchy(data.new, null, userId);
      } catch (err) {
        await db.query('ROLLBACK');
        return res.status(400).json({ status: false, message: err.message });
      }
    }

    // Delete
    if (Array.isArray(data.delete)) {
        const allIdsToDelete = new Set();
        for (const id of data.delete) {
            const stack = [id];
            while (stack.length > 0) {
                const currentId = stack.pop();
                allIdsToDelete.add(currentId);
                const [children] = await db.query(
                    `SELECT id FROM master WHERE parent_id = ?`,
                    { replacements: [currentId] }
                );
                for (const child of children) {
                    stack.push(child.id);
                }
            }
        }
        if (allIdsToDelete.size > 0) {
            await db.query(
                `DELETE FROM master WHERE id IN (${[...allIdsToDelete].map(() => '?').join(',')})`,
                { replacements: [...allIdsToDelete] }
            );
        }
    }

    await db.query('COMMIT');
    return res.status(200).json({ status: true, message: 'Product types updated successfully' });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    console.log('handled_updated_failed', QueryTime);
      const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;
      res.status(status_code).json({
          status: error_status,
          message: error_message
      });
  }
};

// export const UpdateProductType = async (req, res) => {

//   const QueryTime = await getCurrentISTTime();
//   console.log('Current IST Time:', QueryTime);
//   console.log('NEW_MASTERS');

//   console.log('handled_updated_initiated', QueryTime);

//   const userId = req.user?.id;
//   const lastmodifiedby = userId;
  
//   try {
//     console.log('handled_updated_initiated1111', QueryTime);

//     let data = req.body;

//     function validateNoCAfterVInHierarchy(nodes, keyName = 'root') {
//         if (!Array.isArray(nodes)) return { success: true };

//         let vFound = false;
//         for (const node of nodes) {
//             const type = node?.type;
//             if (type === 'V') {
//                 vFound = true;
//             } else if (type === 'C' && vFound) {
//                 return {
//                     success: false,
//                     message: `Invalid type sequence in 'C' cannot come after 'V'.`
//                 };
//             }

//             if (Array.isArray(node.children)) {
//                 const result = validateNoCAfterVInHierarchy(node.children, `${keyName} -> ${node.name}`);
//                 if (!result.success) return result;
//             }
//         }

//         return { success: true };
//     }
//     const checks = [
//         validateNoCAfterVInHierarchy(data.edit, 'edit'),
//         validateNoCAfterVInHierarchy(data.new, 'new'),
//         validateNoCAfterVInHierarchy(data.edit_new, 'edit_new')
//     ];

//     const failedCheck = checks.find(c => !c.success);
//     if (failedCheck) {
//         return res.status(400).json({ status: false, message: failedCheck.message });
//     }
    
//     await db.query('START TRANSACTION');
    
//     if (Array.isArray(data.edit)) {
//         for (const item of data.edit) {
//             const name = item.name?.trim();

//             const [[existing]] = await db.query(
//                 `SELECT name, parent_id FROM master WHERE id = ?`,
//                 { replacements: [item.id] }
//             );

//             if (existing?.name !== name) {
//                 const [[dup]] = await db.query(
//                     `SELECT id FROM master WHERE name = ? AND parent_id <=> ? AND id != ?`,
//                     { replacements: [name, existing?.parent_id, item.id] }
//                 );

//                 if (dup) {
//                     try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                     return res.status(400).json({ status: false, message: `Duplicate name '${name}' exists under this parent.`});
//                 }
//             }

//             await db.query(
//                 `UPDATE master SET name = ?, type = ?, lastmodifiedby = ? WHERE id = ?`,
//                 { replacements: [name, item?.type || null, lastmodifiedby, item?.id] }
//             );
//         }
//     }
//     if (Array.isArray(data.new)) {
//         async function insertHierarchy(nodes, parentId = null, lastmodifiedby) {
//             const nameSet = new Set();

//             for (const node of nodes) {
//                 const trimmed = node.name?.trim().toLowerCase();
//                 console.log('trimmedName', trimmed);

//                 if (nameSet.has(trimmed)) {
//                     try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                     return res.status(400).json({ status: false, message: `Duplicate name '${trimmed}' found in request under same parent`});
//                 }
//                 nameSet.add(trimmed);

//                 const [[dup]] = await db.query(
//                     `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//                     { replacements: [trimmed, parentId] }
//                 );
//                 if (dup) {
//                     try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                     return res.status(400).json({ status: false, message: `Duplicate name '${trimmed}' already exists.`});
//                 }

//                 const result = await db.query(
//                     `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//                     { replacements: [trimmed, parentId, node?.type || null, lastmodifiedby] }
//                 );

//                 const insertedId = result[0];
//                 console.log(`Inserted ${trimmed} -> ID ${insertedId}`);

//                 if (Array.isArray(node.children) && node.children.length > 0) {
//                     await insertHierarchy(node.children, insertedId, lastmodifiedby);
//                 }
//             }
//         }

//         await insertHierarchy(data.new, null, userId);
//     }
//     if (Array.isArray(data.edit_new)) {
//         for (const item of data.edit_new) {
//             const parentId = item.parent_id || null;
//             const name = item?.name?.trim();

//             const [[dup]] = await db.query(
//                 `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//                 { replacements: [name, parentId] }
//             );
//             if (dup) {
//                 try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                 return res.status(400).json({ status: false, message: `Duplicate name '${name}' already exists under this parent.`});
//             }

//             const result = await db.query(
//                 `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//                 { replacements: [name, parentId, item?.type || null, lastmodifiedby] }
//             );

//             const insertedId = result[0];
//             console.log(`Inserted node: ${name} with id: ${insertedId} under parent_id: ${parentId}`);

//             if (Array.isArray(item.children) && item.children.length > 0) {
//                 const childNameSet = new Set();

//                 for (const child of item.children) {
//                     const trimmed = child.name?.trim().toLowerCase();
//                     if (childNameSet.has(trimmed)) {
//                         try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                         return res.status(400).json({ status: false, message: `Duplicate child '${child.name}' under '${name}' (in request)`});
//                     }
//                     childNameSet.add(trimmed);

//                     const [[childDup]] = await db.query(
//                         `SELECT id FROM master WHERE name = ? AND parent_id <=> ?`,
//                         { replacements: [child.name, insertedId] }
//                     );
//                     if (childDup) {
//                         try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//                         return res.status(400).json({ status: false, message: `Child duplicate '${child.name}' under ${name}`});
//                     }

//                     await db.query(
//                         `INSERT INTO master (name, parent_id, type, lastmodifiedby) VALUES (?, ?, ?, ?)`,
//                         { replacements: [child.name, insertedId, child.type, lastmodifiedby] }
//                     );
//                 }
//             }
//         }
//     }
//     if (Array.isArray(data.delete)) {
//         const allIdsToDelete = new Set();

//         for (const id of data.delete) {
//             const stack = [id];

//             while (stack.length > 0) {
//                 const currentId = stack.pop();
//                 allIdsToDelete.add(currentId);

//                 const [children] = await db.query(
//                     `SELECT id FROM master WHERE parent_id = ?`,
//                     { replacements: [currentId] }
//                 );
//                 for (const child of children) {
//                     stack.push(child.id);
//                 }
//             }
//         }
//         if (allIdsToDelete.size > 0) {
//             await db.query(
//                 `DELETE FROM master WHERE id IN (${[...allIdsToDelete].map(() => '?').join(',')})`,
//                 { replacements: [...allIdsToDelete] }
//             );
//         }
//     }

//     await db.query('COMMIT');
//     return res.status(200).json({ status: true, message: 'Product types updated successfully' });

//   } catch (error) {
//     try { await db.query('ROLLBACK'); } catch { console.log('rollback fails') }
//     console.error(error);
//     console.log('handled_updated_failed', QueryTime);
    
//       const errorFetch = handleSequelizeError(error);
//       const status_code = errorFetch?.statusCode || 500
//       const error_message = errorFetch?.message
//       const error_status = errorFetch?.status

//       res.status(status_code).json({
//           status: error_status,
//           message: error_message
//       });
//   }
// };

export const GetProductType = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log('Current IST Time:', QueryTime);
  console.log('handled_get_initiated', QueryTime);

  try {

    let table = req.params.table;
    const id = req.query.id;
    const searchTerm = req.query.search || '';
    const { tableName, primaryKeyField, defaultSortField, sortField, sortOrder, usePagination, page, pageSize, offset } = req.getcheck;
    console.log('resultError',req.precheck);

    let whereConditions = [];
    let whereParams = [];

    const PageClause = usePagination == true ?  `LIMIT ${pageSize} OFFSET ${offset} `: ``;
    console.log('PageClause',PageClause);

    const sortFieldExists = MASTER_CONFIG[table].fields.some(field => field.name === sortField);
    const safeSort = sortFieldExists ? sortField : defaultSortField;

    let whereClause = 'WHERE parent_id IS NULL';

    if (id) {
       whereConditions.push(`${primaryKeyField} = ?`);
       whereParams.push(id);
     }

    if (searchTerm) {
       whereConditions.push(`locate(?, name) > 0`);
       whereParams.push(searchTerm);
     }

    if (whereConditions.length > 0) {
       whereClause += ' AND ' + whereConditions.join(' AND ');
     }

     let rootQuery = `SELECT * FROM master ${whereClause} ORDER BY ${safeSort} ${sortOrder || 'ASC'} ${PageClause}`;
      const [rootNodes] = await db.query(rootQuery, { replacements: whereParams });

      if (!rootNodes || rootNodes.length === 0) {
        return res.status(200).json({
          status: true,
          issuccess: true,
          count: 0,
          data: []
        });
      }

      const rootIds = rootNodes.map(r => r.id);
      const placeholders = rootIds.map(() => '?').join(',');
      const childQuery = `
        WITH RECURSIVE tree AS (
          SELECT * FROM master WHERE id IN (${placeholders})
          UNION ALL
          SELECT m.* FROM master m
          INNER JOIN tree t ON m.parent_id = t.id
        )
        SELECT * FROM tree ORDER BY parent_id IS NULL DESC, parent_id, id
      `;
      const [fullTree] = await db.query(childQuery, { replacements: rootIds });
      const cleanedRecords = fullTree;
      const buildTree = (items, parentId = null) => {
        return items
          .filter(item => item.parent_id === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id)
          }));
      };

      const hierarchicalData = buildTree(cleanedRecords);
      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM master ${whereClause}`, { replacements: whereParams });

      return res.status(200).json({
        status: true,
        issuccess: true,
        count: total,
        data: hierarchicalData
      });

  } catch (error) {
    console.error('Error in handleGet:', error);
    res.status(500).json({
      status: false,
      issuccess: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};