const { DataTypes } = require('sequelize');
const { db } = require('../public/javascripts/db/db');

// This defines the way we store the Token on the database.
const wxAgents = db.define(
  'wxAgents',
  {
    
    taskId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      unique:true,
    },
    program: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    appNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    caseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    formId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    formName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentumid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    underscored: false,
  }
);

module.exports = { wxAgents };