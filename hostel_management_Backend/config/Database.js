// database.js
import { Sequelize } from "sequelize";
import dotenv from 'dotenv';
dotenv.config(); 


export const db = new Sequelize(process.env.DB_DATABASE, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: "mysql",
    dialectOptions: {
        connectTimeout: 60000 // Set timeout to 60 seconds
    }
});


export const connectDB = async () => {
    try {
        await db.authenticate();
        console.log('Connection to the database has been established successfully.');
        console.log('Connected to database:', process.env.DB_DATABASE);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

export const performQuery = async (query, params = [], isDataRequest = false) => {
    try {
      await db.authenticate();
      console.log("DB connection successful.");
  
      if (isDataRequest) {
        const result = await db.query(query, {
          replacements: params,
          type: db.QueryTypes.SELECT,
        });
  
        return result;
      } else {
        const [result] = await db.query(query, {
          replacements: params,
          type: Sequelize.QueryTypes.RAW,
        });
  
        if (result && result.insertId) {
          return result.insertId; 
        }
  
        const lastInsertIdQuery = "SELECT LAST_INSERT_ID() AS insertId";
        const lastInsertIdResult = await db.query(lastInsertIdQuery, {
          type: Sequelize.QueryTypes.SELECT,
        });
  
        return lastInsertIdResult[0] || null;
      }
    } catch (error) {
      console.error("Error executing query on DB:", error);
      // throw new Error("Failed to execute query on DB", error);
      throw error
    } finally {
      console.log("DB connection closed.");
    }
};

export default {connectDB,performQuery};
