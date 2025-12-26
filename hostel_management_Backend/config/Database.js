// database.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

export const db = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,

    timezone: "+05:30", // ✅ THIS is the real fix

    dialectOptions: {
      connectTimeout: 120000,
      decimalNumbers: true,
    },

    pool: {
      max: 10,
      min: 0,
      acquire: 120000,
      idle: 20000,
    },
  }
);

export const connectDB = async () => {
  try {
    await db.authenticate();
    console.log(
      "Connection to the database has been established successfully."
    );
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

export const performQuery = async (
  query,
  params = [],
  isDataRequest = false
) => {
  try {
    // Sequelize pool handles connection automatically — no need to authenticate each time
    if (isDataRequest) {
      return await db.query(query, {
        replacements: params,
        type: db.QueryTypes.SELECT,
      });
    } else {
      const [result] = await db.query(query, {
        replacements: params,
      });
      return result;
    }
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
};

export default { connectDB, performQuery };
