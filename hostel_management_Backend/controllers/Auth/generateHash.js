import bcrypt from 'bcrypt';

const password = 'adminsuper';
const saltRounds = 10;

(async () => {
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Hashed password:', hash);
})();

//node controllers\Auth\generateHash.js  


// product type masters request body example:
// {
//   "name": "Electronics",
//   "children": [
//     {
//       "name": "Laptop",
//       "children": ["Brand", "Series", "RAM"]
//     },
//     {
//       "name": "Printers",
//       "children": ["Type", "Model", "Size"]
//     }
//   ]
// }



// adding asset 
// {
//   "assetid": 10002,
//   "assetrfid":"RFID-111",
//   "price": 10000,
//   "vendor_id": 1,
//   "status": 1,
//   "lastmodifiedby": 4,

  
//   "masterIds": [206],           
//   "gmasterValueIds": [1, 5]    
// }


// Example API endpoint for getting paginated users
//http://localhost:5004/api/v1/get_masters/users?page=1&pageSize=7

// Api for getting master hierarchy by id
//http://localhost:5004/api/v1/master-hierarchy?id=207

// Example SQL to set an auto-increment primary key
//ALTER TABLE your_table_name
//MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY;


// rolepermission table seeding example
// INSERT INTO rolepermission (role_id, permission_id)
// SELECT 1, id FROM permissions;
