import { DataTypes } from 'sequelize';
import {db} from '../config/Database.js';

const UserLog = db.define(
  'userlog',
  {
    userid: {
      type: DataTypes.STRING,
    },
    lastlogin: {
      type: DataTypes.STRING,
    },
    logout: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: false, // Disable timestamps for createdAt and updatedAt
  }
);

export default UserLog;
